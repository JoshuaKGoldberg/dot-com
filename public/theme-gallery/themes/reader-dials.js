const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

const DENSITY = { compact: 0.62, cozy: 1, airy: 1.45 };

export function activate({ root, reducedMotion }) {
	const mq = matchMedia("(prefers-contrast: more)");
	const header = root.querySelector(".site-header");
	const state = {
		density: "cozy",
		contrast: mq.matches ? "high" : "normal",
		size: 100,
		measure: 62,
		motion: !(reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches),
	};

	const gear = document.createElement("button");
	gear.type = "button";
	gear.className = "dials-gear";
	gear.setAttribute("aria-expanded", "true");
	gear.setAttribute("aria-controls", "dials-panel");
	gear.innerHTML = `${GEAR}<span>Reading settings</span>`;
	header.append(gear);

	const seg = (name, legend, options) => `
		<fieldset class="dials-group"><legend>${legend}</legend>
			<div class="dials-seg">${options.map(([v, l]) => `<label><input type="radio" name="dials-${name}" value="${v}"><span>${l}</span></label>`).join("")}</div>
		</fieldset>`;

	const panel = document.createElement("section");
	panel.className = "dials-panel";
	panel.id = "dials-panel";
	panel.setAttribute("aria-label", "Reading settings");
	panel.innerHTML = `
		<div class="dials-head"><h2>Reading settings</h2><p>Saved nowhere; applies to this page only.</p></div>
		<div class="dials-grid">
			${seg("density", "Density", [["compact", "Compact"], ["cozy", "Cozy"], ["airy", "Airy"]])}
			${seg("contrast", "Contrast", [["normal", "Normal"], ["high", "High"], ["xhigh", "Extra high"]])}
			<div class="dials-group">
				<label class="dials-label" for="dials-size">Text size <span class="dials-value" id="dials-size-out"></span></label>
				<input class="dials-range" id="dials-size" type="range" min="85" max="150" step="5" aria-describedby="dials-size-out" />
				<div class="dials-ticks" aria-hidden="true"><span>A</span><span style="font-size:1.25em">A</span></div>
			</div>
			<div class="dials-group">
				<label class="dials-label" for="dials-measure">Line length <span class="dials-value" id="dials-measure-out"></span></label>
				<input class="dials-range" id="dials-measure" type="range" min="40" max="90" step="2" aria-describedby="dials-measure-out" />
				<div class="dials-ticks" aria-hidden="true"><span>narrow</span><span>wide</span></div>
			</div>
			<div class="dials-group">
				<label class="dials-switch"><span>Motion</span>
					<input id="dials-motion" type="checkbox" role="switch" /><span class="dials-track" aria-hidden="true"></span>
				</label>
				<p class="dials-hint" id="dials-motion-hint"></p>
			</div>
		</div>
		<div class="dials-foot"><span>Tab to move, arrow keys to change, Escape closes.</span><button class="dials-reset" type="button">Reset to defaults</button></div>`;
	header.append(panel);

	const q = (s) => panel.querySelector(s);
	const sizeIn = q("#dials-size");
	const measureIn = q("#dials-measure");
	const motionIn = q("#dials-motion");

	function apply() {
		root.style.setProperty("--dSpace", DENSITY[state.density]);
		root.style.setProperty("--dLine", state.density === "compact" ? 1.42 : state.density === "airy" ? 1.75 : 1.58);
		root.style.setProperty("--dTextSize", state.size / 100);
		root.style.setProperty("--dMeasure", `${state.measure}ch`);
		root.style.setProperty("--dMotion", state.motion ? 1 : 0);
		if (state.contrast === "normal") delete root.dataset.contrast;
		else root.dataset.contrast = state.contrast;
		root.dataset.motion = state.motion ? "on" : "off";
		for (const n of ["density", "contrast"]) {
			for (const r of panel.querySelectorAll(`input[name="dials-${n}"]`)) r.checked = r.value === state[n];
		}
		sizeIn.value = state.size;
		measureIn.value = state.measure;
		motionIn.checked = state.motion;
		q("#dials-size-out").textContent = `${state.size}%`;
		q("#dials-measure-out").textContent = `${state.measure} characters`;
		q("#dials-motion-hint").textContent = state.motion ? "Animations and smooth scrolling are on." : "Animations are off.";
		sizeIn.setAttribute("aria-valuetext", `${state.size} percent`);
		measureIn.setAttribute("aria-valuetext", `${state.measure} characters`);
	}

	const on = (el, type, fn) => el.addEventListener(type, fn);
	on(panel, "change", (e) => {
		const t = e.target;
		if (t.name === "dials-density") state.density = t.value;
		if (t.name === "dials-contrast") state.contrast = t.value;
		if (t === motionIn) state.motion = t.checked;
		apply();
	});
	on(sizeIn, "input", () => { state.size = +sizeIn.value; apply(); });
	on(measureIn, "input", () => { state.measure = +measureIn.value; apply(); });
	on(q(".dials-reset"), "click", () => {
		Object.assign(state, { density: "cozy", contrast: mq.matches ? "high" : "normal", size: 100, measure: 62 });
		apply();
	});
	on(gear, "click", () => {
		const open = panel.hidden;
		panel.hidden = !open;
		gear.setAttribute("aria-expanded", String(open));
	});
	on(panel, "keydown", (e) => {
		if (e.key === "Escape") { panel.hidden = true; gear.setAttribute("aria-expanded", "false"); gear.focus(); }
	});
	apply();

	return () => {};
}
