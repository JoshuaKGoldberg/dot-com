import { panel, h, clamp, loop } from "./_sensor/kit.js";

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-c");
	const canvas = h("canvas", { class: "mm-grass", "aria-hidden": "true" });
	layer.append(canvas);
	const ctx = canvas.getContext("2d");
	let W = 0, H = 0, dpr = 1;
	let blades = [];
	let level = 0; // smoothed, 0..1
	let raw = 0; // input target
	let simVol = 0;
	let impulse = 0;
	let micOn = false;
	let stream, audio, analyser, buf, srcNode;
	let tPhase = 0;

	const dark = () => document.documentElement.classList.contains("dark");
	const mulberry = (a) => () => ((a = (a + 0x6d2b79f5) | 0), (((t) => (t = Math.imul(t ^ (t >>> 15), t | 1)) ^ (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ (t >>> 14))(a) >>> 0) / 4294967296);

	function build() {
		const rnd = mulberry(177);
		blades = [];
		const n = Math.round(clamp(W / 7, 60, 220));
		for (let i = 0; i < n; i++) {
			const back = i % 3 === 0;
			blades.push({
				x: (i + rnd() * 0.8) * (W / n),
				h: (back ? 0.55 : 0.8) * H * (0.45 + rnd() * 0.55),
				w: 3 + rnd() * 4.5,
				ph: rnd() * 6.28,
				sp: 1.4 + rnd() * 1.6,
				rest: (rnd() - 0.5) * 0.18,
				back,
				flower: !back && rnd() < 0.1,
				hue: rnd(),
			});
		}
	}

	function fit() {
		dpr = Math.min(devicePixelRatio || 1, 1.5);
		W = layer.clientWidth;
		H = Math.max(80, Math.round(layer.clientHeight * 0.2));
		canvas.style.height = H + "px";
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		build();
		draw();
	}

	function draw() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		const d = dark();
		const pal = d
			? { back: ["#1f5a43", "#256b50"], front: ["#2f8a62", "#3fa876", "#56c28d"], flower: ["#ffd37a", "#f7a8c6", "#bcd4ff"] }
			: { back: ["#9fd4a6", "#8cc99b"], front: ["#5fb27a", "#4aa36c", "#74c28a"], flower: ["#f59e0b", "#e0558f", "#6d6df0"] };
		for (const pass of [true, false]) {
			for (const b of blades) {
				if (b.back !== pass) continue;
				const sway = reducedMotion ? 0 : Math.sin(tPhase * b.sp + b.ph);
				const amp = level * (b.back ? 0.5 : 1);
				// lean in px at the tip: static rest lean + sway scaled by loudness + a loudness-driven wind bend
				const lean = b.rest * b.h + (sway * 0.9 + 0.55) * amp * b.h * 0.9;
				const baseY = H + 2;
				const tipX = b.x + lean;
				const tipY = baseY - b.h * (1 - amp * 0.12);
				ctx.beginPath();
				ctx.moveTo(b.x - b.w / 2, baseY);
				ctx.quadraticCurveTo(b.x - b.w / 2 + lean * 0.15, baseY - b.h * 0.6, tipX, tipY);
				ctx.quadraticCurveTo(b.x + b.w / 2 + lean * 0.15, baseY - b.h * 0.6, b.x + b.w / 2, baseY);
				ctx.closePath();
				const set = b.back ? pal.back : pal.front;
				ctx.fillStyle = set[Math.floor(b.hue * set.length)];
				ctx.fill();
				if (b.flower) {
					ctx.beginPath();
					ctx.arc(tipX, tipY, 3.2 + b.w * 0.25, 0, 6.283);
					ctx.fillStyle = pal.flower[Math.floor(b.hue * 3) % 3];
					ctx.fill();
				}
			}
		}
		meter.style.transform = `scaleX(${clamp(level, 0, 1).toFixed(3)})`;
	}

	const lp = loop((dt) => {
		tPhase += dt;
		if (micOn && analyser) {
			analyser.getByteTimeDomainData(buf);
			let s = 0;
			for (let i = 0; i < buf.length; i++) {
				const v = (buf[i] - 128) / 128;
				s += v * v;
			}
			raw = clamp(Math.sqrt(s / buf.length) * 5, 0, 1);
		} else {
			impulse *= Math.pow(0.04, dt);
			raw = clamp(simVol / 100 + impulse, 0, 1);
		}
		const k = raw > level ? 0.35 : 0.06; // fast attack, slow release
		level += (raw - level) * k;
		draw();
		if (!micOn && level < 0.004 && raw < 0.004) {
			level = 0;
			draw();
			lp.stop();
		}
	});
	const kick = () => {
		if (reducedMotion) {
			level = raw = clamp(simVol / 100 + impulse, 0, 1);
			draw();
		} else lp.start();
	};

	const meter = h("i");
	const ui = panel(root, {
		title: "Mic meadow",
		statusIdle: "The grass sways with sound. Off until you say so.",
		privacy: "Audio is analysed for loudness only, in your browser. It is never recorded, stored or sent.",
		enable: { label: "Use my microphone", run: enable },
		stopLabel: "Stop microphone",
		onStop: stop,
		simLabel: "Simulate volume",
		controls: [
			{ type: "range", id: "vol", label: "Volume", min: 0, max: 100, value: 0, format: (v) => `${v}%`, onInput: (v) => { simVol = v; kick(); } },
		],
	});
	ui.el.querySelector(".sx-sim").append(h("div", { class: "sx-actions" }, h("button", { class: "sx-chip", type: "button", onclick: () => { impulse = 0.9; kick(); } }, "Clap"), h("div", { class: "mm-meter", style: "flex:1;align-self:center" }, meter)));

	async function enable() {
		if (!navigator.mediaDevices?.getUserMedia) {
			ui.status("No microphone API here. Use the volume simulator.");
			return;
		}
		ui.status("Asking for the microphone…");
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
		} catch {
			ui.status("Microphone access was not granted. The simulator still works.");
			return;
		}
		const AC = window.AudioContext || window.webkitAudioContext;
		audio = new AC();
		srcNode = audio.createMediaStreamSource(stream);
		analyser = audio.createAnalyser();
		analyser.fftSize = 512;
		buf = new Uint8Array(analyser.fftSize);
		srcNode.connect(analyser); // analyser is never connected to the output: silent, no feedback
		micOn = true;
		ui.setActive(true);
		ui.status("Listening. Hum, clap or talk.");
		lp.start();
	}
	function stop() {
		micOn = false;
		stream?.getTracks().forEach((t) => t.stop());
		srcNode?.disconnect();
		audio?.close?.();
		stream = audio = analyser = srcNode = undefined;
		ui.setActive(false);
		ui.status("Microphone off. The grass sways with sound; off until you say so.");
		raw = 0;
		kick();
	}

	const ro = new ResizeObserver(() => requestAnimationFrame(fit));
	ro.observe(layer);
	fit();
	return () => {
		micOn = false;
		stream?.getTracks().forEach((t) => t.stop());
		srcNode?.disconnect();
		audio?.close?.();
		ro.disconnect();
		lp.destroy();
		ui.destroy();
		canvas.remove();
	};
}
