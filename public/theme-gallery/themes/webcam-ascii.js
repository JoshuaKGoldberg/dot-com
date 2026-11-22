import { panel, h, loop } from "./_sensor/kit.js";

const COLS = 60;
const ROWS = 30;
const RAMP = " .:-=+*#%@";

export function activate({ root }) {
	const hero = root.querySelector(".site-hero");
	const portrait = root.querySelector(".site-portrait");
	const pre = h("pre", { class: "wa-ascii", "aria-hidden": "true" });
	const badge = h("span", { class: "wa-badge" }, "Portrait");
	const frame = h("figure", { class: "wa-frame", "data-source": "portrait", "aria-label": "ASCII rendering" }, pre, badge);
	portrait.after(frame);

	const grab = document.createElement("canvas");
	grab.width = COLS;
	grab.height = ROWS;
	const g = grab.getContext("2d", { willReadFrequently: true });
	const dark = () => document.documentElement.classList.contains("dark");

	let source = "portrait"; // portrait | demo | camera
	let stream, video;
	let lastDraw = 0;
	let disposed = false;

	function toAscii() {
		const d = g.getImageData(0, 0, COLS, ROWS).data;
		const inv = false;
		const lum = new Float32Array(COLS * ROWS);
		for (let i = 0; i < lum.length; i++) lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
		// auto-levels: stretch the 4th..96th percentile so any lighting gives a readable image
		const sorted = Float32Array.from(lum).sort();
		const lo = sorted[Math.floor(lum.length * 0.04)];
		const hi = sorted[Math.floor(lum.length * 0.96)];
		const span = Math.max(0.12, hi - lo);
		let out = "";
		for (let y = 0; y < ROWS; y++) {
			for (let x = 0; x < COLS; x++) {
				let l = Math.min(1, Math.max(0, (lum[y * COLS + x] - lo) / span));
				if (inv) l = 1 - l;
				out += RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))];
			}
			out += "\n";
		}
		pre.textContent = out;
	}

	function drawPortrait() {
		const img = root.querySelector(dark() ? ".site-portrait-dark" : ".site-portrait-light");
		if (!img?.complete || !img.naturalWidth) return false;
		g.fillStyle = "#000";
		g.fillRect(0, 0, COLS, ROWS);
		const w = img.naturalWidth, hh = img.naturalHeight;
		g.drawImage(img, w * 0.17, hh * 0.15, w * 0.66, hh * 0.66, 0, 0, COLS, ROWS);
		toAscii();
		return true;
	}

	function drawDemo(t) {
		// A synthetic "feed": a drifting lit head-and-shoulders silhouette over a soft moving gradient.
		g.fillStyle = "#101418";
		g.fillRect(0, 0, COLS, ROWS);
		const grd = g.createRadialGradient(COLS * (0.5 + 0.3 * Math.sin(t * 0.7)), ROWS * 0.3, 2, COLS / 2, ROWS / 2, COLS * 0.7);
		grd.addColorStop(0, "#6a7a8f");
		grd.addColorStop(1, "#10151c");
		g.fillStyle = grd;
		g.fillRect(0, 0, COLS, ROWS);
		const cx = COLS / 2 + Math.sin(t * 1.1) * 5;
		const cy = ROWS * 0.42 + Math.sin(t * 2.2) * 0.8;
		g.fillStyle = "#e8e8e8";
		g.beginPath();
		g.ellipse(cx, cy, 8, 10, Math.sin(t) * 0.12, 0, 7);
		g.fill();
		g.fillStyle = "#b4b8bf";
		g.beginPath();
		g.ellipse(cx, ROWS + 2, 18, 11, 0, Math.PI, 0);
		g.fill();
		g.fillStyle = "#222";
		g.fillRect(cx - 4, cy - 2, 2, 1.2);
		g.fillRect(cx + 2, cy - 2, 2, 1.2);
		g.fillRect(cx - 2.5, cy + 3.5 + Math.sin(t * 3) * 0.4, 5, 0.9);
		toAscii();
	}

	function drawCamera() {
		if (!video || video.readyState < 2) return;
		const vw = video.videoWidth || 320;
		const vh = video.videoHeight || 240;
		// cover-crop to the char-aspect-corrected grid, mirrored like a mirror
		const targetAspect = 1; // frame is square (COLS x ROWS render as square)
		let sw = vw, sh = vh;
		if (vw / vh > targetAspect) sw = vh * targetAspect;
		else sh = vw / targetAspect;
		g.save();
		g.translate(COLS, 0);
		g.scale(-1, 1);
		g.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, COLS, ROWS);
		g.restore();
		toAscii();
	}

	const lp = loop((dt, t) => {
		if (t - lastDraw < 1 / 12) return;
		lastDraw = t;
		if (source === "demo") drawDemo(t);
		else if (source === "camera") drawCamera();
	});

	function setSource(next, label) {
		source = next;
		frame.dataset.source = next;
		badge.textContent = label;
		if (next === "portrait") {
			lp.stop();
			drawPortrait();
		} else lp.start();
	}

	const ui = panel(root, {
		title: "Webcam ASCII",
		statusIdle: "Josh in ASCII. Turn on your camera to see yourself instead.",
		privacy: "Video is turned into text locally. Nothing is recorded, uploaded or stored.",
		enable: { label: "Use my camera", run: enable },
		stopLabel: "Stop camera",
		onStop: stop,
		simLabel: "Simulator",
		controls: [
			{
				type: "buttons", id: "src", label: "Source (no permission needed)", value: "portrait",
				options: [{ value: "portrait", label: "Portrait" }, { value: "demo", label: "Demo feed" }],
				onPick: (v) => {
					if (stream) stop();
					setSource(v, v === "demo" ? "Demo feed" : "Portrait");
					ui.status(v === "demo" ? "A synthetic feed, no camera involved." : "Josh in ASCII.");
				},
			},
		],
	});

	async function enable() {
		if (!navigator.mediaDevices?.getUserMedia) {
			ui.status("No camera API in this browser. Try the demo feed.");
			return;
		}
		ui.status("Asking for the camera…");
		try {
			stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" }, audio: false });
		} catch {
			ui.status("Camera access was not granted. Try the demo feed.");
			return;
		}
		if (disposed) {
			stream.getTracks().forEach((t) => t.stop());
			return;
		}
		video = document.createElement("video");
		video.muted = true;
		video.playsInline = true;
		video.srcObject = stream;
		await video.play().catch(() => {});
		ui.set("src", "");
		setSource("camera", "Live camera");
		ui.setActive(true);
		ui.status("Camera on. You are the ASCII art now.");
	}
	function stop() {
		stream?.getTracks().forEach((t) => t.stop());
		if (video) video.srcObject = null;
		stream = video = undefined;
		ui.setActive(false);
		ui.set("src", "portrait");
		setSource("portrait", "Portrait");
		ui.status("Camera off. Josh in ASCII.");
	}

	// Defer the first portrait render so startup stays free.
	const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 60));
	const cancelIdle = window.cancelIdleCallback ?? clearTimeout;
	const tryPortrait = () => {
		if (source === "portrait" && !drawPortrait()) setTimeout(tryPortrait, 150);
	};
	const idleId = idle(tryPortrait);

	// redraw static portrait when the colour mode flips
	const mo = new MutationObserver(() => source === "portrait" && drawPortrait());
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	return () => {
		disposed = true;
		cancelIdle(idleId);
		mo.disconnect();
		stream?.getTracks().forEach((t) => t.stop());
		if (video) video.srcObject = null;
		lp.destroy();
		ui.destroy();
	};
}
