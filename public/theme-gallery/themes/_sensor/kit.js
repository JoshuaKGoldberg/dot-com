// Shared opt-in sensor panel for themes 176-185. Costs nothing until a theme calls panel().

const h = (tag, props = {}, ...kids) => {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(props)) {
		if (k === "class") el.className = v;
		else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
		else if (v !== undefined && v !== false) el.setAttribute(k, v === true ? "" : v);
	}
	el.append(...kids.flat().filter((k) => k != null));
	return el;
};
export { h };

let uid = 0;

/**
 * panel(root, {
 *   title, privacy, enable: {label, run}, stopLabel, onStop, controls: [...], statusIdle
 * })
 * controls: {type:"range", id, label, min, max, step, value, format, onInput}
 *           {type:"buttons", id, label, options:[{value,label}], value, onPick}
 *           {type:"text", id, label, placeholder, onSubmit}
 *           {type:"toggle", id, label, value, onChange}
 */
export function panel(root, opts) {
	const id = `sx-${++uid}`;
	const controls = {};
	const status = h("p", { class: "sx-status", "aria-live": "polite" }, opts.statusIdle ?? "");
	const body = h("div", { class: "sx-body", id: `${id}-body` });
	const head = h(
		"button",
		{ class: "sx-head", type: "button", "aria-expanded": "true", "aria-controls": `${id}-body` },
		h("span", { class: "sx-title" }, opts.title),
		h("span", { class: "sx-chev", "aria-hidden": "true" }),
	);
	const el = h("aside", { class: "sx-panel", "aria-label": opts.title }, head, body);
	const setOpen = (open) => {
		head.setAttribute("aria-expanded", String(open));
		body.hidden = !open;
		el.classList.toggle("is-closed", !open);
	};
	head.addEventListener("click", () => setOpen(head.getAttribute("aria-expanded") !== "true"));

	body.append(status);

	let enableBtn, stopBtn;
	const api = {
		el,
		status(text) {
			status.textContent = text;
		},
		setActive(active) {
			el.classList.toggle("is-active", active);
			if (enableBtn) enableBtn.hidden = active;
			if (stopBtn) stopBtn.hidden = !active;
		},
		set(idKey, value) {
			controls[idKey]?.set(value);
		},
		get(idKey) {
			return controls[idKey]?.get();
		},
		open: setOpen,
		destroy() {
			el.remove();
		},
	};

	if (opts.enable) {
		enableBtn = h("button", { class: "sx-btn sx-primary", type: "button" }, opts.enable.label);
		stopBtn = h("button", { class: "sx-btn sx-stop", type: "button", hidden: true }, opts.stopLabel ?? "Stop");
		enableBtn.addEventListener("click", async () => {
			enableBtn.disabled = true;
			try {
				await opts.enable.run();
			} catch (error) {
				api.status(error?.message || String(error));
				api.setActive(false);
			} finally {
				enableBtn.disabled = false;
			}
		});
		stopBtn.addEventListener("click", () => opts.onStop?.());
		body.append(h("div", { class: "sx-actions" }, enableBtn, stopBtn));
	}

	if (opts.controls?.length) {
		const fs = h("fieldset", { class: "sx-sim" }, h("legend", {}, opts.simLabel ?? "Simulator"));
		for (const c of opts.controls) {
			const cid = `${id}-${c.id}`;
			if (c.type === "range") {
				const out = h("output", { for: cid }, "");
				const input = h("input", { id: cid, type: "range", min: c.min, max: c.max, step: c.step ?? 1, value: c.value });
				const fmt = (v) => (c.format ? c.format(+v) : String(v));
				const update = () => (out.textContent = fmt(input.value));
				input.addEventListener("input", () => {
					update();
					c.onInput?.(+input.value);
				});
				update();
				controls[c.id] = {
					set(v) {
						input.value = v;
						update();
					},
					get: () => +input.value,
				};
				fs.append(h("div", { class: "sx-row" }, h("label", { for: cid }, c.label), out), input);
			} else if (c.type === "buttons") {
				const group = h("div", { class: "sx-seg", role: "group", "aria-label": c.label });
				const btns = c.options.map((o) =>
					h("button", { class: "sx-chip", type: "button", "data-value": o.value, "aria-pressed": String(o.value === c.value) }, o.label),
				);
				const set = (v) => btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === String(v))));
				btns.forEach((b) =>
					b.addEventListener("click", () => {
						set(b.dataset.value);
						c.onPick?.(c.options.find((o) => String(o.value) === b.dataset.value).value);
					}),
				);
				group.append(...btns);
				controls[c.id] = { set, get: () => btns.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.value };
				fs.append(h("div", { class: "sx-row" }, h("span", {}, c.label)), group);
			} else if (c.type === "toggle") {
				const input = h("input", { id: cid, type: "checkbox" });
				input.checked = !!c.value;
				input.addEventListener("change", () => c.onChange?.(input.checked));
				controls[c.id] = { set: (v) => (input.checked = !!v), get: () => input.checked };
				fs.append(h("label", { class: "sx-check", for: cid }, input, c.label));
			} else if (c.type === "text") {
				const input = h("input", { id: cid, type: "text", placeholder: c.placeholder ?? "", autocomplete: "off", "aria-label": c.label });
				const form = h("form", { class: "sx-form" }, input, h("button", { class: "sx-chip", type: "submit" }, c.button ?? "Send"));
				form.addEventListener("submit", (e) => {
					e.preventDefault();
					if (input.value.trim()) c.onSubmit?.(input.value.trim());
					input.value = "";
				});
				// keep gallery hotkeys from firing while typing
				input.addEventListener("keydown", (e) => e.stopPropagation());
				controls[c.id] = { set: (v) => (input.value = v), get: () => input.value };
				fs.append(h("div", { class: "sx-row" }, h("span", {}, c.label)), form);
			}
		}
		body.append(fs);
	}
	if (opts.privacy) body.append(h("p", { class: "sx-privacy" }, opts.privacy));
	root.append(el);
	setOpen(!(opts.startClosed ?? window.innerWidth < 700));
	return api;
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** requestAnimationFrame loop that pauses when hidden. returns {start, stop}. */
export function loop(fn) {
	let raf = 0;
	let last = 0;
	const tick = (t) => {
		raf = requestAnimationFrame(tick);
		const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
		last = t;
		fn(dt, t / 1000);
	};
	const onVis = () => (document.hidden ? cancel() : start());
	const cancel = () => {
		cancelAnimationFrame(raf);
		raf = 0;
	};
	const start = () => {
		if (!raf && !document.hidden) {
			last = performance.now();
			raf = requestAnimationFrame(tick);
		}
	};
	document.addEventListener("visibilitychange", onVis);
	return {
		start,
		stop: cancel,
		destroy() {
			cancel();
			document.removeEventListener("visibilitychange", onVis);
		},
		get running() {
			return !!raf;
		},
	};
}
