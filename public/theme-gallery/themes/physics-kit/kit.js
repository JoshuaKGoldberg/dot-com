// Small shared helpers for the physics showpieces (#61-68).

const STYLE = `
.phys-pill{position:fixed;right:1rem;bottom:1rem;z-index:40;display:flex;align-items:center;gap:.2rem;padding:.3rem;border-radius:999px;
 background:color-mix(in srgb,var(--siteBg) 92%,transparent);border:1px solid color-mix(in srgb,var(--siteFg) 20%,transparent);
 box-shadow:0 8px 24px -8px rgb(0 0 0/.35);font:600 .78rem/1 var(--siteFont);color:var(--siteFgStrong);user-select:none;-webkit-user-select:none}
.phys-pill[data-pos=left]{right:auto;left:1rem}
.phys-pill[data-pos=center]{right:auto;left:50%;transform:translateX(-50%)}
.phys-pill[data-pos=top]{bottom:auto;top:1rem}
.phys-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .8rem;border-radius:999px;cursor:pointer;
 color:inherit;font:inherit;letter-spacing:.01em;white-space:nowrap}
.phys-btn:hover{background:color-mix(in srgb,var(--siteAccent) 16%,transparent)}
.phys-btn:focus-visible{outline:2px solid var(--siteAccent);outline-offset:1px}
.phys-btn[aria-pressed=true],.phys-btn.is-primary{background:var(--siteAccent);color:var(--siteBg)}
.phys-btn[disabled]{opacity:.38;cursor:default;background:none}
.phys-btn kbd{font:600 .66rem/1 var(--siteFont);opacity:.65;border:1px solid currentColor;border-radius:4px;padding:.12rem .28rem}
.phys-sep{width:1px;align-self:stretch;margin:.35rem .15rem;background:color-mix(in srgb,var(--siteFg) 20%,transparent)}
.phys-hint{position:absolute;right:.4rem;bottom:calc(100% + .45rem);font:500 .74rem/1.2 var(--siteFont);color:var(--siteMuted);white-space:nowrap;
 text-shadow:0 0 6px var(--siteBg),0 0 2px var(--siteBg);pointer-events:none}
.phys-pill[data-pos=left] .phys-hint,.phys-pill[data-pos=center] .phys-hint{right:auto;left:.4rem}
.phys-pill[data-pos=top] .phys-hint{bottom:auto;top:calc(100% + .45rem)}
@media (max-width:640px){.phys-hint{white-space:normal;max-width:70vw}}
`;

export function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text != null) node.textContent = text;
	return node;
}

/** Adds the shared pill-control styles (inside root, so the gallery restores it for us). */
export function injectKitStyle(root) {
	const style = el("style");
	style.textContent = STYLE;
	root.append(style);
}

/**
 * Builds a control pill. items: {id,label,key,primary,pressed,onClick} or "sep".
 * Returns {pill, buttons, hint(text)}.
 */
export function createPill(root, { items, hint, pos = "right", label = "Physics controls" }) {
	injectKitStyle(root);
	const pill = el("div", "phys-pill");
	pill.dataset.pos = pos;
	pill.setAttribute("role", "toolbar");
	pill.setAttribute("aria-label", label);
	const buttons = {};
	for (const item of items) {
		if (item === "sep") {
			pill.append(el("span", "phys-sep"));
			continue;
		}
		const button = el("button", "phys-btn");
		button.type = "button";
		button.dataset.id = item.id;
		const text = el("span", "", item.label);
		button.append(text);
		if (item.key) {
			button.append(el("kbd", "", item.key.toUpperCase()));
			button.title = `${item.title ?? item.label} (${item.key.toUpperCase()})`;
		} else if (item.title) {
			button.title = item.title;
		}
		if (item.primary) button.classList.add("is-primary");
		if (item.pressed !== undefined) button.setAttribute("aria-pressed", String(item.pressed));
		button.addEventListener("click", (event) => {
			event.stopPropagation();
			item.onClick?.(button, event);
		});
		button.labelNode = text;
		buttons[item.id] = button;
		pill.append(button);
	}
	const hintNode = el("div", "phys-hint", hint ?? "");
	pill.append(hintNode);
	root.append(pill);
	return {
		pill,
		buttons,
		hint(text) {
			hintNode.textContent = text;
		},
	};
}

/** Registers key handlers on window; claims only the keys given. Returns remove(). */
export function bindKeys(map) {
	const handler = (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target;
		if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
		const fn = map[event.key.toLowerCase()];
		if (fn) {
			event.preventDefault();
			fn(event);
		}
	};
	window.addEventListener("keydown", handler);
	return () => window.removeEventListener("keydown", handler);
}

/** True when the event target is something we must not hijack (links, buttons, controls). */
export function isInteractiveTarget(target) {
	return target instanceof Element && !!target.closest("a, button, input, textarea, select, summary, .phys-pill");
}

/**
 * Fixed-timestep loop. step(dt seconds) runs at `hz`; render(alpha) once per frame.
 * start()/stop() are idempotent; the loop self-stops if step returns false ("asleep").
 */
export function createLoop({ step, render, hz = 60, maxSteps = 3, onStop }) {
	let raf = 0;
	let last = 0;
	let acc = 0;
	const dt = 1 / hz;
	function frame(now) {
		raf = requestAnimationFrame(frame);
		if (!last) last = now;
		acc += Math.min(0.1, (now - last) / 1000);
		last = now;
		let steps = 0;
		let awake = false;
		while (acc >= dt && steps < maxSteps) {
			if (step(dt) !== false) awake = true;
			acc -= dt;
			steps++;
		}
		if (steps === maxSteps) acc = 0;
		render?.(acc / dt);
		if (!awake && steps > 0) {
			loop.stop();
			onStop?.();
		}
	}
	const loop = {
		start() {
			if (!raf) {
				last = 0;
				acc = 0;
				raf = requestAnimationFrame(frame);
			}
		},
		stop() {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		},
		get running() {
			return raf !== 0;
		},
	};
	return loop;
}

export function whenIdle(fn, timeout = 600) {
	if ("requestIdleCallback" in window) {
		const id = requestIdleCallback(fn, { timeout });
		return () => cancelIdleCallback(id);
	}
	const id = setTimeout(fn, 50);
	return () => clearTimeout(id);
}

export function dprCap(max = 1.5) {
	return Math.min(window.devicePixelRatio || 1, max);
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
