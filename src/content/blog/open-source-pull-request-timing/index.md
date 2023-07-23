---
description: "Maintenance and development costs run both ways. Open source contributors and maintainers alike have to balance their finite energy and time resources within many constraints."
pubDate: 2022-03-07
title: "Why Open Source Pull Requests Can Take A While"
---

Open source software is wonderful.
You can collaborate on the latest and greatest in developer technology with bright minds across the world.

But, there are costs to participating in open source software:

- **Contextualization**: You must generally familiarize yourself with a project's technologies to meaningfully contribute to it
- **Coordination**: There is some overhead to working with any programming tooling, including Git, GitHub, package registries, and so on
- **Development Energy**: For many of us, there's only so much time per day and/or week we can stand coding
- **Social Energy**: For many of us, there's only so much time per day and/or week we can stand communicating with other developers
- **Time**: There are only so many hours in the day to spend on open source software

Open source contributors and maintainers alike have to balance their finite energy and time resources within those constraints.
Open source repositories are software projects like any other: they have deliverables, a set of team priorities, and a finite list of resources to work with.

I don't want to discourage anybody from participating in open source --really, it's fantastic; I highly recommend it!-- but do want to surface why open source pull requests can take a while.
This blog post is an overview of many of the common factors that go into an open source pull request taking weeks, months, or more to be merged.

I think this information is useful to help developers understand how open source reviews week.
It's also a useful reference alongside this deep dive for an open source pull request I sent that took three years to merge: [TypeScript Contribution Diary: Allowing Code in Constructors Before `super()`](https://blog.joshuakgoldberg.com/code-before-super).

## Most Pull Requests Are Nontrivial

Pull requests that exclusively change a comment or documentation typo are generally quick and straightforward to both author and review.

Most pull requests, though, touch more than just comments or docs.
They involve some kind of runtime logic change and hopefully include a corresponding test change as well.
These pull requests involve real thought for both their creators and the maintainer(s) who review them.

For the creator of the pull request, there is a nontrivial work associated that involves at least:

- Identifying an issue from the issue tracker that matches their technical interest and level of expertise
- Understanding any nuances associated with the issue and potential solutions
- Creating the pull request's changes to code, documentation, and tests
- Describing the pull request

The maintainer's side has its own complexities too:

- Understanding the issue again and confirming it's still valid
- Reading through and understanding the pull request's changes (this could become their code to maintain, after all!
- Running the project with the changes to test them out
- Confirming the changes match their short- and long-term vision for the project
- Describe any change requests in a polite and supportive manner

Imagine a maintainer on a popular open source project who needs to perform, say, twenty pull request reviews a week on average.
If each task takes only five minutes on average, that's (5 tasks / pull request) x (5 minutes / task) x (20 pull requests / week) = 500 minutes a week.
They're spending over eight hours a week _just reviewing pull requests_ -- and we're assuming each pull request review is a quick and seamless process!

## Large Pull Requests Are Particularly Difficult

All those difficulties are amplified when a pull request involves many changes and/or is in a particularly tricky area to work with.
Larger pull requests cause a corresponding larger amount of work for both contributors and maintainers to coordinate around, review, QA in beta, and so on.
Many open source teams already don't have the time budget to process their review queue quickly.
Throwing in large pull requests slows down those queues even more.

More cost is added to larger pull request because open source reviews are by nature often asynchronous.
Often days, weeks, or even larger stretches of time can pass between reviews.
That means both sides of the review may have to ramp themselves back into having context on the pull request.
That can be a nontrivial amount of time ranging from minutes to hours each time a side needs to review.

Additionally, for larger open source projects, more code a pull request touches, the more likely it is to touch an area relatively fewer maintainers have deep expertise on.
Repeatedly coordinating an expert to look at an external contributor's large, tricky pull request is a tough ask.
They're likely already in high demand for other maintenance tasks and might have less time to spare.

## Final Thoughts

A pull request staying open a long time is unfortunate but is bound to happen from time to time.
It's important to understand why that's the case and to maintain empathy for both sides of the review through the process.

Many thanks to [Daniel Rosenwasser](https://twitter.com/drosenwasser) discussing the reviewer's side of larger pull requests in the context of [TypeScript Contribution Diary: Allowing Code in Constructors Before `super()`](https://blog.joshuakgoldberg.com/code-before-super).
