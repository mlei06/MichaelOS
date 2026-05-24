---
id: automatic-flagpole
year: 2024
blurb: Per-pole controllers that raise and lower Duke's flags autonomously. The proxy was decaying — time wasn't flag position.
role: Lead software · team of 4
tags:
  - C++
  - ESP32
  - PlatformIO
  - MQTT
  - Embedded
status: field-tested
hero:
  src: /media/automatic-flagpole-product-sketch.png
---

# The proxy was decaying

Duke's grounds staff told us they were spending hundreds of staff-hours and thousands of dollars a year changing flags by hand. Somebody physically visited every campus pole, lowered the old flag, raised a new one, walked to the next. Fall 2024, a stakeholder interview, a clear problem to solve.

Our team's plan was a per-pole controller that drove the flag mechanically with motorized compression wheels, ran off solar plus a lithium-ion battery, and answered to a web app over MQTT. I was lead software developer and owned the ESP32 firmware (C++ on PlatformIO) and the browser UI end-to-end; teammates owned the mechanical, electrical, and power subsystems.

![Hand-drawn system sketch: a vertical flagpole with a pulley at the top and a flag mid-pole, a pair of compression wheels around a drive wheel near the base, an ESP32-and-motor enclosure powered by a LiFePO4 battery and solar panel, and a laptop webapp talking to it wirelessly.](/media/automatic-flagpole-product-sketch.png)

*The system at a glance: one autonomous unit per pole, talking to a web UI over MQTT.*

One detail mattered more than the rest of that paragraph: once we mounted a unit on a pole, no one was going to physically touch it again for months. Anything the firmware couldn't recover from on its own meant somebody climbing a pole. That's the constraint that turned every later design decision into a structural question instead of a tuning question, including the one this post is about, which is how the firmware knew when the flag had reached the top.

## The first version stopped on a timer

The first working version stopped the motor on a calibrated timer. Raise for N seconds, lower for M. We picked N and M on a bench rig with a single flag, a fresh battery, and a controlled temperature, and it worked perfectly. The flag arrived exactly where it was supposed to, every time, on the first try. We mounted the rig, ran it on real cycles, and within about an hour it stopped working.

Not stopped. Drifted. The flag would land at different positions on different runs. Cold mornings stopped differently from afternoons. A freshly-charged battery stopped differently from a battery at 60%. One flag fabric gripped the compression wheels differently from another, so the same N seconds rolled the flag a different distance up the pole.

My first instinct, and this is the part of the story I'm a little embarrassed about, was to compensate for it. Add a temperature term. Adjust N based on battery voltage. Maybe even profile per-flag.

I started writing the temperature one. I had the thermistor reading wired up. I was halfway through deciding whether to scale N linearly with temperature or with the difference from some reference temperature, when I noticed I didn't actually know what the right relationship was. Did colder temperature make the motor pull more current and run slower, or did the wheels grip the fabric tighter and roll less per revolution? I didn't know, and either could plausibly be true, and the answer probably wasn't even constant across our flag fabrics.

That's when it landed. I was tuning a measurement that didn't measure the thing I cared about. I cared about flag position. Time isn't flag position. Time is *correlated* with flag position under conditions that don't actually hold outdoors. Adding compensation terms wasn't going to fix that. It was going to push the failure into a regime where the compensation terms themselves started drifting, and then I'd have two broken proxies stacked on top of each other.

I stopped writing the temperature term and stared at the ceiling for a while.

## The reframe

The question I should have been asking from the start: what does the flag actually do, physically, when it reaches the top of the pole?

The compression wheels can't roll any further. They're pinching the flag between them, driving it up against a fixed point, the top of the pole. When the flag gets there, the wheels stall. A stalled motor on an H-bridge supply pulls a sharp current spike, because the windings keep trying to turn but the rotor can't move, so the back-EMF that would normally limit the current collapses. The current spike is reliable. It happens every time. It doesn't care about temperature, or battery voltage, or fabric.

Time was a proxy; current draw on a stalled motor was the physical event itself.

I sat with that for a minute, because the previous month of work had been built on the assumption that we'd solve the stop problem in software, with timers, on the firmware we already had. Switching to current sensing meant adding hardware: a current sensor, a wired path to one of the ESP32's ADC pins, and all the firmware to actually read and interpret the signal. I was the one who'd have to justify that to a team that had a working v1 in their hands. But the working v1 wasn't working. It was just *passing the bench test*. The two are not the same.

I brought the proposal to the team and we wired in an ACS712 current sensor on the motor supply rail.

![CAD renders of the per-pole enclosure: a profile view showing the compression wheels driven by a small motor on the left and the battery compartment behind, plus two angled views of the sealed housing with mounting holes and the drive-wheel pinch point exposed.](/media/automatic-flagpole-cad.png)

*The enclosure that houses the motor, ESP32, and current sensor — sealed for outdoor mount on the pole.*

## Making it work in firmware

The hardware side of the integration was a couple of pins and a sensor. The firmware side was where the interesting decisions were.

The first non-obvious problem is that a motor spinning up always pulls a spike, and that spike isn't a stall. If you start the motor and read current immediately, the highest reading you'll see for the next several hundred milliseconds is the inrush: a motor accelerating from a standstill draws far more current than it does once it's at speed. If I treated "current above threshold" as the stall condition naively, every run would stop instantly the moment I energized the motor.

So I sample the baseline *after* ramp-up. The motor starts, `MotorController` waits a short fixed interval for the inrush to settle, then takes 20 ADC samples at 10 ms intervals and averages them. That average becomes the running baseline for the rest of the run. From that point on, I watch for sustained excursions above the baseline, not transients, sustained ones, because the ADC is noisy and a single high sample doesn't mean the motor has stalled. The "sustained" part of that matters more than it sounds; without it, the stop condition fires on noise.

The second decision was about calibration. The threshold above which I declare a stall isn't a constant. The exact current draw at stall depends on the specific motor, the supply voltage, the wheels' grip on the specific flag fabric. So instead of hardcoding it, I made the first successful run *be* the calibration. The first time the firmware boots on a fresh device, it runs the motor to a hard stall, records the time it took to get there (`expectedTimeS`) and the current at which the stall was detected (`stallCurrent`), and writes both to NVS. Every run after that uses the persisted values. Calibration survives reboots, OTA updates, and power cycles. The device doesn't have to relearn unless something genuinely changed.

The third decision was about what to do when the calibration *is* wrong, because sooner or later it will be. Replace a flag with a heavier one, change a wheel, the threshold doesn't match anymore. I exposed two MQTT commands on the device's `cmd` topic for handling this remotely: `recalibrate` clears the persisted thresholds and treats the next run as a learning pass, and `factory_reset` wipes NVS entirely and reboots. Both are reachable from the web UI. The grounds staff can re-train a flagpole without leaving their desk, which was the entire point of the project.

The fourth decision was about what to do when the *sensor* is wrong. The ACS712 is reliable but not infallible: a bad reading, a wiring intermittent, an ADC glitch. If the firmware trusts the current sensor unconditionally, a sensor failure that pegs the reading low means the motor never sees a stall and runs forever. So `MotorController` enforces an absolute-max-runtime ceiling regardless of what the current reading says. The ceiling sits well above any plausible legitimate run duration (there's no flag-and-pole combination on which a healthy raise should take that long), so it only ever fires as a safety net. If it does fire, the firmware publishes the outcome as `AbortedAbsoluteMax` rather than `Stalled`, so the UI can show that something went wrong rather than silently treating it as a normal completion.

Stack those four decisions and the stop condition becomes something I'm willing to mount on a pole. The baseline-after-inrush handles the easy startup case. The self-calibration handles the per-device variation. The remote re-train handles the slow drift over the device's lifetime. The absolute-max ceiling handles the case where the whole sensing chain has failed. Each one is a few dozen lines of firmware; together they cover the failure modes I can name.

## What it taught me

The lesson I keep coming back to from this project isn't really about flagpoles or motors. It's about the shape of the bug.

When a measurement starts drifting, and your first instinct is to add compensation terms, temperature-corrects, voltage-adjusts, per-condition tuning, that instinct is a tell. It's the signal that you're measuring a proxy and the proxy is decaying. The compensation terms will let you push the drift further before it's visible again, but they don't fix the underlying problem, which is that the thing you're measuring isn't the thing you care about. Sooner or later you'll be debugging the compensation terms themselves.

The cleaner move, almost always, is to find the physical event you actually care about and measure that directly, even if it costs a hardware change or a redesign. Time was correlated with flag position under bench conditions. Current draw on a stalled motor was flag-at-the-top.

I think about that distinction a lot now, what am I measuring, and what do I actually care about, and how related are those two things? The answer to the third question is usually less obvious than it looks.
