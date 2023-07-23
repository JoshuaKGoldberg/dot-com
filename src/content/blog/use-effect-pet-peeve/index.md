---
description: "Explaining why using useEffect to initialize values is dangerous."
image:
  alt: TODO
  src: TODO
pubDate: 2021-09-08
title: "useEffect Pet Peeve: Side Effects, Not Initialization"
---

React's [`useEffect` API](https://reactjs.org/docs/hooks-effect.html) is a fantastically useful hook that allows for "side effect" logic to be run in function components.
`useEffect` has many uses ranging from asynchronous data fetching to interacting with browser APIs.

However!
Overusing `useEffect` can cause crashes or confusing behavior in your components.
In particular I've developed a pet peeve around code unnecessarily wrapping synchronous variable initialization code in a `useEffect` hook.
Allow me to explain why...

## Bug: Initially Missing Data

Take a look at this `WaitingQueue` component that renders a queue of names.
It stores a list of names in a queue with a button to pop to the next one if there are any left.

```jsx
import { useEffect, useState } from "react";

function getNames() {
	return ["Abed", "Annie", "Britta", "Jeff", "Pierce", "Shirley", "Troy"];
}

function WaitingQueue() {
	const [remaining, setRemaining] = useState(); // 😬

	useEffect(() => {
		setRemaining(getNames());
	}, []);

	if (!remaining.length) {
		return <div>Nobody left!</div>;
	}

	const next = () => {
		setRemaining((previous) => previous.slice(1));
	};

	return (
		<button onClick={next} role="button">
			{remaining[0]} is first.
		</button>
	);
}
```

`WaitingQueue`'s state management works by:

1. Initially starting `remaining` off with no value: `undefined`
2. Running a `useEffect` to `setRemaining` to the result of `getNames()`

This version of the `WaitingQueue` component will crash on first render!
Because the `remaining` piece of state starts off as `undefined`, asking for `remaining.length` throws an error.

```ts
// TypeError: cannot read property 'length' of undefined
if (!remaining.length) {
	return <div>Nobody left!</div>;
}
```

**`useEffect` does not run functions immediately**.
Its functions are run _after_ render.

Creating a piece of state without an initial value and only giving it a value in a `useEffect` hook means it that it will be `undefined` for at least one render during the function.

> Fun fact: this bug would have been caught by TypeScript!
> TypeScript would have seen that `remaining` is type `undefined` and complained about retrieving property `length` on an `undefined` value.
> [[Playground link](https://www.typescriptlang.org/play?jsx=1#code/JYWwDg9gTgLgBAbzgVwM4FMCiAzb6DGMANChgMowCGM6cAvnNlBCHAERTqWFsDcAsACgh2ZADtCwCGLgBzdDABylEOlQAKAJSIhcPXE4xkUGQG02AQQBG6ACZsSlsWODoH7AEJRgMKu7YAUui4-gAKrlD4bo5kABbAUAA26ACe-gAqzGkAugKCdEIi4pLScADqlD7AYrIAisjoDVo6gvpw+NKo8KacIJUuNSQYMABK6H3V1bLZcAC8pOgU1OgAPF3eNabZAHxavHAA9AdwgLwbgDR7ha36aFi4BDDqzbPbLW1tw2MTA7Lq8koqai0mjybToJC2wMubWA2Dg6gAhL1+lMAHTJGowWLaBC6N56QzGGQrWzAABu20UECsEFsKTgyWwMHhKwOJPJIP0BWEVz0HTEXTgYnQAA94PMni8cTy3h9xsiao8wJxSVI0NpnnAlegVRA0CjUIlgFF1ABGTSQ6V0PK4-EKQlwm1vFZWZC+UrSADChvwAGtZgghaKGMxkrM2C63WI2NtHXi9AgkZNNgAGbIMYCoRgJLoo2P6FkRmDSGPSi10IA)]

## Bug: Initially Wrong Data

I've also seen a lot of gut reactions on how to fix the above crash.
One common strategy is to provide some default stub value for the state to be used until the `useEffect` hook runs.

```jsx
import { useEffect, useState } from "react";

function getNames() {
	return ["Abed", "Annie", "Britta", "Jeff", "Pierce", "Shirley", "Troy"];
}

function WaitingQueue() {
	const [remaining, setRemaining] = useState([]); // 🤔

	useEffect(() => {
		setRemaining(getNames());
	}, []);

	if (!remaining.length) {
		return <div>Nobody left!</div>;
	}

	const next = () => {
		setRemaining((previous) => previous.slice(1));
	};

	return (
		<button onClick={next} role="button">
			{remaining[0]} is first.
		</button>
	);
}
```

Since `remaining` is an `[]` empty array in the first render pass of the component, it will include a `<div>Nobody left!</div>` message instead of the message including `Abed`.
We fixed the crash! 🎉

Any version of React running on the client will update the DOM extremely quickly after first render.
If your app _only_ runs on the client browser, you likely will never notice any flicker of the initial, wrong message on your screen.

Unfortunately for us, the first render of a React component can be quite important for a production webiste.
[Static site generation (SSG)](https://nextjs.org/docs/basic-features/pages#static-generation-recommended) and [server-side rendering (SSR)](https://nextjs.org/docs/basic-features/pages#server-side-rendering) are popular and important performance solutions for code.
This first-render bug means the statically rendered version of the website will have the wrong first value.
So this bug is still something you'll probably want to fix.

```html
<!-- view-source:https://localhost:3000 -->
<div>Nobody left!</div>
```

## Solution: Initial Data

The bugfix is my favorite kind.
It involves deleting code and simplifying logic.

We can remove the `useEffect` altogether and start `remaining` off equal to `getNames()`.

```jsx
import { useState } from "react";

function getNames() {
	return ["Abed", "Annie", "Britta", "Jeff", "Pierce", "Shirley", "Troy"];
}

function WaitingQueue() {
	const [remaining, setRemaining] = useState(getNames());

	if (!remaining.length) {
		return <div>Nobody left!</div>;
	}

	const next = () => {
		setRemaining((previous) => previous.slice(1));
	};

	return (
		<button onClick={next} role="button">
			{remaining[0]} is first.
		</button>
	);
}
```

```html
<!-- view-source:https://localhost:3000 -->
<div>Abed is first.</div>
```

Running a `useEffect` to update the `remaining` state from an initial value to an updated one was unnecessary.

Cool.
Cool cool cool.

### Moral of the Story

Don't run `useEffect` updates you don't need.

If a piece of state is meant to start off pointing to data you always have access to, you can use that data as the initial value for the state.

Instead of this:

```jsx
const [data, setData] = useState();

useEffect(() => {
	setData(initialValue);
}, []);
```

...most of the time, probably do this:

```jsx
const [data, setData] = useState(initialValue);
```

#### What About Other Data Behaviors?

Everything I've said so far about how you shouldn't use `useEffect` to initialize a synchronous value indeed only applies to _synchronous_ values _initialized once_.

If the data is asynchronously loaded then sure, you're not going to be able to start off with it available synchronously.
You might want to use a `useEffect` that initializes the call to load the data:

```jsx
function MyComponent({ value }) {
	const [data, setData] = useState();

	useEffect(() => {
		loadData().then(setData).catch(setData);
	}, []);

	// ...
}
```

Even if the data is loaded synchronously and immediately available, you may still wish to add a `useEffect` to reset the value.
For example, if your component is meant to reset the display whenever a prop changes, you can both pass the value as an initial state and reset it on change:

```jsx
function MyComponent({ value }) {
	const [data, setData] = useState(value);

	useEffect(() => {
		setData(value);
	}, [value]);

	// ...
}
```

> _Updated August 21st, 2022: [@TkDodo](https://twitter.com/TkDodo) on [Twitter mentions](https://twitter.com/TkDodo/status/1560858411868327936 "TkDodo tweet response to this article") that this could often be [better solved with a `key`](https://tkdodo.eu/blog/putting-props-to-use-state)._ ✨

### Understand Your Effects

Built-in React hook APIs such as `useEffect` are intentionally flexible and can be used in a variety of ways.
Understanding how they work can greatly help you avoid common pitfalls and bugs when using them.

I hope this post was useful to you in at least showing one of the ways `useEffect` can blow up.
[Let me know on Twitter](https://www.twitter.com/JoshuaKGoldberg)!
