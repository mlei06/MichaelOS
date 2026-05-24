# Idea 01: Composition over inheritance

## v1 — Stop Asking "Is-A or Has-A"
*Angle: the IS-A heuristic is misunderstood; here's what to use instead*

Every intro to object-oriented programming teaches the same two examples. A dog IS-A animal, so use inheritance. A car HAS-A engine, so use composition. The heuristic is so common that "prefer composition over inheritance" has become a slogan people repeat without quite understanding what it's pointing at.

The dog and car examples work because everyone agrees what a dog is. Real software isn't built out of dogs and cars. Real software has `Event`, `Subscribeable`, `Repository`, `StaffResource`: abstractions that don't map cleanly to physical reality, and where "is-a" stops being obvious the moment you have to commit.

Take an `Employee`. Sure, an Employee IS-A Person. Inheritance feels right. But an Employee is also a `StaffResource`, and a `Contractor` is a StaffResource but not an Employee. Now imagine the system has to handle a police department where the staff also includes trained dogs, entitled to healthcare and a retirement plan. The StaffResource hierarchy now has two conflicting parent branches and nowhere clean to put `TrainedDog`. The IS-A heuristic doesn't fail because it's wrong; it fails because real systems have multiple, overlapping classifications and inheritance only lets you pick one.

The deeper problem is that "is-a" is doing two different jobs at once, and people only notice one of them.

When a class inherits from another, two things are happening. First, the subclass declares a subtype to the outside world. It's saying "treat me like the parent type." That's the externally-facing contract. Second, the subclass pulls in the parent's method implementations. That's internal, mechanical reuse. Outside code doesn't care about the second one. It only cares about the first.

IS-A is about the contract. It's a statement to other code that "you can use me wherever you'd use my parent." Mammal taxonomy is a useful analogy. Biologists don't classify something as a mammal by looking at its DNA. They look at behavior and physiology: breathes air, nurses young, has hair. You're not a mammal because you're a *refinement* of some archetypal mammal class. You're a mammal because you look and act like one. The category is about the API, not the implementation.

This matters because most of the time, when people reach for inheritance, they're not actually making a claim about subtype contracts. They want to reuse code. They have a class that does some useful things, and a new class that needs to do some of those same things, and inheritance looks like the cheap way to wire it up. It is. It's also exactly the case where inheritance bites you.

A few specific reasons it bites:

**You only get one parent.** Most OO languages allow exactly one base class. If you've burned your single inheritance slot on a serialization framework's required base, you can't use it for your own domain hierarchy. There's an old phrase: "don't burn your base class." You don't realize you've burned it until the next thing that wants to be a parent shows up.

**Complexity accumulates downward.** A subclass carries its own complexity plus the complexity of every class above it. Five levels deep, the leaf class is dragging a chain of behaviors most readers can't hold in their head at once. Composed systems isolate responsibilities into distinct objects you can test in isolation. Inherited systems force you to reason about a stack.

**You can't parameterize a base class.** In most languages, generics can't pick which class you inherit from. You can have a subclass whose base is `ArrayList` or one whose base is `LinkedList`, but you can't have one whose base is "whichever list type the caller picked." With composition you just delegate to whatever list implementation you got handed.

**Inheritance can produce incorrect behavior.** Effective Java has a famous example: a `HashSet` subclass that counts how many items have been added. The author overrode `add` and `addAll` to bump the counter. The count ends up doubled, because `HashSet.addAll` is implemented by calling `add` internally, so each added element goes through the counter twice. The fix isn't to be more careful with inheritance. The fix is to use a decorator that wraps the set and forwards calls, which is composition. The bug only existed because inheritance bound the subclass to implementation details of the parent that weren't part of any documented contract.

So when should you actually use inheritance? When you mean the IS-A contract. When you want callers to be able to use your subclass anywhere they'd use the parent, and you're willing to honor the parent's full behavioral contract, not just its method signatures. If you're inheriting for any other reason, especially for code reuse, compose instead.

Here's the rule I've landed on after dealing with both ends of this:

If you find yourself saying "Foo isn't really a Bar, but it needs to do some of the things a Bar does," that is the moment to compose. Give Foo a Bar field, or take a Bar as a constructor argument. The temptation in that moment is to inherit anyway, because it's two fewer lines of code and you don't have to think about delegation. That's the trap. You're declaring a subtype relationship that isn't true, and the codebase will be paying interest on that lie for as long as it lives.

Conversely, "prefer composition over inheritance" doesn't mean inheritance is wrong. There are real cases where you mean the IS-A contract, where polymorphism is exactly what you want, where callers should be able to treat the subclass as the parent. Inheritance in those cases is fine. The dogma misreads the advice. The advice isn't "never inherit." It's "don't use inheritance as a shortcut to reuse code when what you actually want is just to reuse code."

The IS-A vs HAS-A heuristic is a starting point. It's a way to introduce the concepts. It is not a verdict. Most real systems have things that are kind of one thing and kind of another, that need different classifications in different contexts, where inheritance would force a false commitment. In those cases, which is most cases, your Foo doesn't need to be a Bar or a Baz. It can just be a Foo that happens to have the properties of both, and that's allowed to be the whole story.

The original advice was meant to push people away from inheritance as a default. It worked, in the sense that more people know about composition now. It also hardened into a slogan that gets repeated without the underlying point, which is its own failure mode. You end up with codebases full of composition for its own sake, or with developers who half-remember the rule and apply it inconsistently.

What you actually want is to stop asking "is-a or has-a" as if those were the only two options, and start asking what contract you're trying to declare to the rest of the codebase. If the answer is "I want callers to substitute this for the parent," inherit. If the answer is "I want to use some of this thing's behavior, but I'm not making any subtype claims," compose. Both are useful. Neither is a default. Picking between them is a design decision every time.
