import { panel, h, clamp } from "./_sensor/kit.js";

const TIERS = [
	{ id: "dark", from: 0, label: "Dark room" },
	{ id: "dim", from: 10, label: "Dim room" },
	{ id: "indoor", from: 100, label: "Indoor" },
	{ id: "bright", from: 2000, label: "Bright, by a window" },
	{ id: "sun", from: 20000, label: "Direct sun" },
];
const MAXLOG = 5; // 1 to 100,000 lux

export function activate({ root }) {
	let lux = 250;
	let tierIdx = 2;
	let source = "sim"; // sim | sensor | camera
	let sensor, stream, video, canvas, ctx, timer;
	let smooth;

	const pin = h("span", { class: "al-pin" });
	const read = h("span", { class: "al-read" });
	const meter = h("div", { class: "al-meter", "aria-hidden": "false" }, h("div", { class: "al-bar", "aria-hidden": "true" }, pin), read);

	function tierFor(v) {
		// hysteresis: stay in the current tier until the value clears the boundary by 20%
		let i = TIERS.findLastIndex((t) => v >= t.from);
		if (i !== tierIdx) {
			const edge = i > tierIdx ? TIERS[i].from * 1.2 : TIERS[tierIdx].from / 1.2;
			if (i > tierIdx ? v < edge : v > edge) i = tierIdx;
		}
		return i;
	}
	function apply(v, fromSlider) {
		lux = clamp(v, 1, 100000);
		tierIdx = tierFor(lux);
		const t = TIERS[tierIdx];
		root.dataset.lux = t.id;
		pin.style.left = `${(Math.log10(lux) / MAXLOG) * 100}%`;
		read.textContent = `≈ ${lux < 100 ? lux.toFixed(0) : Math.round(lux).toLocaleString()} lux · ${t.label}${source === "camera" ? " (camera estimate)" : source === "sim" ? " (simulated)" : ""}`;
		if (!fromSlider) ui.set("lux", Math.round((Math.log10(lux) / MAXLOG) * 100));
	}

	const ui = panel(root, {
		title: "Ambient light",
		statusIdle: "Contrast adapts to the room. Simulated for now.",
		privacy: "Light readings (or camera brightness) stay in your browser. No frames are saved or sent.",
		enable: { label: "Use light sensor", run: enableSensor },
		stopLabel: "Stop sensing",
		onStop: stop,
		simLabel: "Simulate room light",
		controls: [
			{ type: "range", id: "lux", label: "Brightness (log scale)", min: 0, max: 100, value: 50, format: (v) => `${Math.round(10 ** ((v / 100) * MAXLOG)).toLocaleString()} lx`, onInput: (v) => { if (source !== "sim") stop(); source = "sim"; apply(10 ** ((v / 100) * MAXLOG), true); } },
			{ type: "buttons", id: "pre", label: "Presets", value: "", options: [{ value: 3, label: "Night" }, { value: 40, label: "Lamp" }, { value: 400, label: "Office" }, { value: 5000, label: "Window" }, { value: 50000, label: "Sun" }], onPick: (v) => { if (source !== "sim") stop(); source = "sim"; apply(v); } },
		],
	});
	ui.el.querySelector(".sx-sim").prepend(meter);
	const camBtn = h("button", { class: "sx-btn al-alt", type: "button" }, "Use camera as a light meter");
	camBtn.addEventListener("click", async () => {
		camBtn.disabled = true;
		try { await enableCamera(); } catch (e) { ui.status(e?.message || "Camera unavailable."); } finally { camBtn.disabled = false; }
	});
	ui.el.querySelector(".sx-actions").after(camBtn);

	async function enableSensor() {
		if (!("AmbientLightSensor" in window)) {
			ui.status("This browser has no ambient light sensor (it is behind a flag in Chrome). Try the camera meter, or the slider.");
			return;
		}
		try {
			const perm = await navigator.permissions?.query({ name: "ambient-light-sensor" }).catch(() => null);
			if (perm && perm.state === "denied") throw new Error("Light sensor permission is denied.");
			sensor = new window.AmbientLightSensor({ frequency: 2 });
			sensor.addEventListener("reading", () => { source = "sensor"; apply(sensor.illuminance ?? 1); });
			sensor.addEventListener("error", (e) => { ui.status(`Light sensor unavailable: ${e.error?.name ?? "error"}. Use the slider.`); stop(); });
			sensor.start();
			source = "sensor";
			ui.setActive(true);
			camBtn.hidden = true;
			ui.status("Reading the ambient light sensor.");
		} catch (e) {
			ui.status(e?.message || "Could not start the light sensor.");
		}
	}
	async function enableCamera() {
		if (!navigator.mediaDevices?.getUserMedia) {
			ui.status("No camera API. Use the slider.");
			return;
		}
		ui.status("Asking for the camera (brightness only)…");
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 160 }, height: { ideal: 120 } }, audio: false });
		} catch {
			ui.status("Camera access was not granted. Use the slider.");
			return;
		}
		video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.srcObject = stream;
		await video.play().catch(() => {});
		canvas = document.createElement("canvas");
		canvas.width = 16;
		canvas.height = 12;
		ctx = canvas.getContext("2d", { willReadFrequently: true });
		source = "camera";
		smooth = undefined;
		ui.setActive(true);
		camBtn.hidden = true;
		ui.status("Camera on as a rough light meter. Only average brightness is used.");
		sample();
		timer = setInterval(sample, 700);
	}
	function sample() {
		if (document.hidden || !video || video.readyState < 2) return;
		ctx.drawImage(video, 0, 0, 16, 12);
		const d = ctx.getImageData(0, 0, 16, 12).data;
		let s = 0;
		for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
		const lum = s / (d.length / 4) / 255; // 0..1; webcams auto-expose, so this is only a proxy
		smooth = smooth == null ? lum : smooth * 0.7 + lum * 0.3;
		apply(10 ** (clamp(smooth, 0, 1) * 4.6 + 0.2));
	}
	function release() {
		clearInterval(timer);
		timer = 0;
		try { sensor?.stop(); } catch { /* ignore */ }
		sensor = undefined;
		stream?.getTracks().forEach((t) => t.stop());
		if (video) video.srcObject = null;
		stream = video = undefined;
	}
	function stop() {
		release();
		source = "sim";
		ui.setActive(false);
		camBtn.hidden = false;
		ui.status("Sensing off. Contrast adapts to the room; simulated for now.");
		apply(lux);
	}

	apply(lux);
	return () => {
		release();
		ui.destroy();
	};
}
