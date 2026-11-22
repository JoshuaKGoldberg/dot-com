import { panel, h, clamp } from "./_sensor/kit.js";

const TIERS = [
	{ min: 50, id: "full", label: "Full effects" },
	{ min: 25, id: "ok", label: "Effects paused, fewer shapes" },
	{ min: 15, id: "low", label: "Static, minimal" },
	{ min: 0, id: "saver", label: "Saver: text only, dimmed" },
];

export function activate({ root }) {
	const scenery = root.querySelector(".scenery-a");
	for (let i = 0; i < 5; i++) scenery.append(h("div", { class: "ba-orb" }));

	let level = 72; // percent
	let charging = false;
	let battery;
	let live = false;

	const fill = h("i", { class: "ba-fill" });
	const cell = h("div", { class: "ba-cell", "aria-hidden": "true" }, fill);
	const text = h("span", { class: "ba-tier", "aria-live": "polite" });
	const title = () => ui.el.querySelector(".sx-title");

	function apply() {
		const eff = charging ? Math.max(level, 55) : level; // plugged in? keep the nice stuff
		const tier = TIERS.find((t) => eff >= t.min);
		root.dataset.tier = tier.id;
		cell.dataset.tier = tier.id;
		// dim as the battery falls: 0 above 50%, up to 0.2 (light) / 0.4 (dark) near empty
		const dimMax = document.documentElement.classList.contains("dark") ? 0.4 : 0.14;
		root.style.setProperty("--batDim", (clamp((50 - eff) / 50, 0, 1) * dimMax).toFixed(3));
		fill.style.transform = `scaleX(${clamp(level / 100, 0.02, 1)})`;
		text.textContent = `${Math.round(level)}%${charging ? " charging" : ""} · ${tier.label}`;
		if (title()) title().textContent = `Battery aware · ${Math.round(level)}%`;
	}

	const ui = panel(root, {
		title: "Battery aware",
		statusIdle: "Simulated battery. The page spends less as it drains.",
		privacy: "The battery level is read locally and never stored or sent.",
		enable: { label: "Use my battery", run: enable },
		stopLabel: "Stop reading",
		onStop: stopLive,
		simLabel: "Simulate battery",
		controls: [
			{ type: "range", id: "lvl", label: "Level", min: 1, max: 100, value: level, format: (v) => `${v}%`, onInput: (v) => { if (live) stopLive(); level = v; apply(); } },
			{ type: "toggle", id: "chg", label: "Charging", value: false, onChange: (v) => { if (live) stopLive(); charging = v; apply(); } },
			{ type: "buttons", id: "pre", label: "Presets", value: "", options: [{ value: 90, label: "Full" }, { value: 40, label: "Half" }, { value: 20, label: "Low" }, { value: 8, label: "Critical" }], onPick: (v) => { if (live) stopLive(); level = v; ui.set("lvl", v); apply(); } },
		],
	});
	ui.el.querySelector(".sx-sim").prepend(h("div", { class: "ba-gauge" }, cell, text));
	// Keep the gauge visible when the panel body is collapsed.

	const read = () => {
		level = Math.round(battery.level * 100);
		charging = battery.charging;
		ui.set("lvl", level);
		ui.set("chg", charging);
		apply();
	};
	async function enable() {
		if (!navigator.getBattery) {
			ui.status("The Battery API is not available here (Safari and Firefox omit it). Use the simulator.");
			return;
		}
		battery = await navigator.getBattery();
		live = true;
		battery.addEventListener("levelchange", read);
		battery.addEventListener("chargingchange", read);
		ui.setActive(true);
		ui.status("Reading your real battery.");
		read();
	}
	function stopLive() {
		live = false;
		if (battery) {
			battery.removeEventListener("levelchange", read);
			battery.removeEventListener("chargingchange", read);
		}
		ui.setActive(false);
		ui.status("Back to the simulated battery.");
	}

	apply();
	return () => {
		if (battery) {
			battery.removeEventListener("levelchange", read);
			battery.removeEventListener("chargingchange", read);
		}
		ui.destroy();
	};
}
