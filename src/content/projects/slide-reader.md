---
id: slide-reader
year: 2025
blurb: A coarse-to-fine auto-tuner for a 7-knob computer-vision pipeline. Replaced hand-tuning a slider panel for every assay slide.
role: Solo · Chilkoti Lab
tags:
  - Python
  - OpenCV
  - Flask
  - Computer Vision
status: shipped to lab
hero:
  src: /media/slide-reader-circle-finding.png
---

# Seven coupled parameters and a wrong first answer

![Grayscale fluorescence-microscopy image of an assay slide with rows of small circular spots; each detected spot is outlined in a thin colored ring and grouped into numbered clusters (0, 1, 6, 7, 12, …), with one bottom row of brightly glowing spots also detected.](/media/slide-reader-circle-finding.png)

*Output of the auto-tuner on a real assay slide — circles found, clustered into the grid of spots the assay format expects.*

The first version of my auto-tuner printed `Checked Combinations: 100, 200, 300, ...` and kept printing. I watched it climb past four thousand, did the math on what was left, and closed the terminal.

I was working with the Chilkoti Lab in the summer of 2025. The lab builds cancer-screening assay kits, physical slides patterned with fluorescent spots, and needs a lot of those slides annotated to train the models that read them. There's a tool for it, Slide-Reader: Flask backend, React editing UI, classical computer-vision detection. The detection part is where lab users were spending their patience. To get clean output, somebody had to sit in front of a panel of seven sliders and tune for each slide, one slide at a time. The job I picked up was to delete that step.

## What you actually have to tune

Detection runs as a chain. Log-scale a 16-bit fluorescence TIF down into 8-bit. Gaussian blur to suppress speckle. Threshold for contrast. Canny for edges. Hand the edge map to OpenCV's Hough circle detector. Then cluster the detected circles with DBSCAN into the assay's grid of spots.

The Hough detector and the preprocessing chain together expose seven knobs that matter: `blur_kernel_size`, `contrast_thr`, two Canny thresholds, and the Hough `dp`/`param1`/`param2`. The DBSCAN parameters are also knobs, but the grid geometry is fixed per assay format, so I left those alone. Seven is the number that has to be set every time you load a new slide.

Hand-tuning seven coupled knobs to detect a few hundred spots is exactly the kind of work that humans are bad at and computers should be doing.

## What I tried first

The obvious thing: full grid search. Pick a reasonable range for each parameter, sample some number of points along each range, try every combination, pick whichever gave the best score. There is nothing clever here, but there's also nothing wrong: the algorithm is provably correct, takes about ten lines to write, and has no hyperparameters of its own to babysit.

I built it and ran it on a test slide.

The problem wasn't theoretical bigness. Seven parameters sampled even modestly each blows up fast, somewhere in the high six figures of combinations, each of which runs the full preprocess + Hough + cluster pipeline end-to-end. The deal-breaker wasn't the size of that number in the abstract. It was that this thing has to run *per slide, interactively, while a human is waiting.* Lab users were supposed to click auto-tune and get an answer back before they lost their train of thought. Overnight isn't a budget the workflow has.

I sat with the progress counter for a few minutes and then killed it.

## What I had wrong

The mistake wasn't in the search. The full grid was doing exactly what a full grid does. The mistake was assuming the problem was *find the optimum.* The lab didn't need the optimum; they needed something close to it, cheaply, every slide.

That sounds like a small distinction. It isn't. Once you stop optimizing for "globally best" and start optimizing for "good enough, fast enough," entire algorithm families open up that the full grid quietly forbids. Coarse-to-fine is the one that fit the shape of the problem.

## Coarse-to-fine, with the actual numbers

The structure: two passes (or more), each one a small grid, each one centered on the previous pass's winner.

Pass one starts from a reasonable initial guess for each parameter. For each of the seven, it samples three values: `init - Δ`, `init`, `init + Δ`, with a wide Δ. Three samples per parameter, seven parameters, so the inner pass evaluates 3⁴ × 3³ = 2,187 combinations. The four preprocess params and the three Hough params iterate separately because they compose differently against the pipeline cache, but the math is the same. Evaluate all 2,187 against an objective function. Whichever wins, recenter the next pass on it.

Pass two does the same thing again, but with a smaller Δ; the search-step divisor grows each pass, so the search zooms into the neighborhood of the previous winner. Same 2,187 combinations, but smaller steps, tighter resolution. Two passes is usually enough; three is occasionally worth it.

The whole thing lives in `do_parameter_optimization` and `optimize_the_params` in `Functions/CommonFunctions.py`. It runs in seconds per slide instead of effectively never.

The reason this works is the cost surface is empirically well-behaved enough that the coarse pass's winning region really does contain the global best. If the surface were full of narrow ridges and sharp local maxima, coarse-to-fine would walk right past them. It isn't, and it doesn't.

There's one more piece I had to figure out: the objective function. My first scoring attempt was "count the detected circles." More circles, better params. That broke instantly: permissive parameter sets paint the whole image as circles and score impossibly high. I capped the count at 200 and tried "count the clusters" instead. That broke too: over-segmenting one good spot into a dozen tiny clusters beats correctly identifying one populated spot. The fix was a product, not a sum: `num_circles_in_clusters × num_clusters`, still capped. The product peaks where you have many clusters *and* each cluster is densely populated, which is the shape of a correctly-detected assay grid. Both failure modes punished by the same signal.

Designing the metric was harder than implementing the search.

## What I didn't see coming

I thought the win was the search. The search was what I'd been thinking about. But the thing that made the search work at all was the log-scale normalization in front of it.

Raw 16-bit fluorescence values vary so much between slides that a contrast threshold of 50 means "background" on one slide and "bright spot" on the next. If parameters don't *mean the same thing* across inputs, an auto-tuner has no consistent space to search in. The grid search wasn't slow because grid search is slow. It was slow because every slide was searching a slightly different problem.

Log-scale collapsed that. Take `log10` of the raw image, normalize to 8-bit, and now every slide lives in the same 0–255 range and threshold values transfer. The auto-tuner can find a near-optimum on one slide and that configuration ports as a reasonable starting guess on the next.

I'd put the preprocessing step in before I'd even thought about auto-tuning. I'd done it for a different reason, log scaling makes faint spots visible to the human eye. The fact that it was also the precondition for any automated search to converge wasn't visible to me until the search itself was the thing I was thinking about.

## What it cost me to learn

A correct algorithm that's too slow for the human waiting on it is the wrong algorithm. The full grid wasn't a bad algorithm in the abstract; it was the wrong one for who was on the other end of the click.
