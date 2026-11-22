// D major pentatonic, two octaves up: bright but soft.
const FREQS = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51];
const PARTIALS = [
	[1, 0.9, 2.6],
	[2.76, 0.32, 1.5],
	[5.4, 0.12, 0.8],
	[8.93, 0.04, 0.4],
]; // ratio, gain, decay seconds (inharmonic, like a metal tube)

export function createAudio() {
	const ctx = new (window.AudioContext || window.webkitAudioContext)();
	ctx.resume?.();
	const master = ctx.createGain();
	master.gain.value = 0.16;
	const comp = ctx.createDynamicsCompressor();
	master.connect(comp).connect(ctx.destination);

	// a small generated room: decaying stereo noise, built once
	const len = Math.floor(ctx.sampleRate * 1.6);
	const ir = ctx.createBuffer(2, len, ctx.sampleRate);
	for (let c = 0; c < 2; c++) {
		const d = ir.getChannelData(c);
		for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
	}
	const verb = ctx.createConvolver();
	verb.buffer = ir;
	const wet = ctx.createGain();
	wet.gain.value = 0.55;
	verb.connect(wet).connect(master);

	let voices = 0;
	return {
		ring(i, vel = 1, pan = 0) {
			if (voices >= 6 || ctx.state === "closed") return;
			voices++;
			const t = ctx.currentTime;
			const f0 = FREQS[i % FREQS.length] * (1 + (Math.random() - 0.5) * 0.002);
			const out = ctx.createGain();
			const p = ctx.createStereoPanner?.();
			if (p) {
				p.pan.value = pan * 0.6;
				out.connect(p);
				p.connect(master);
				p.connect(verb);
			} else {
				out.connect(master);
				out.connect(verb);
			}
			let end = t;
			for (const [ratio, g, dec] of PARTIALS) {
				const o = ctx.createOscillator();
				const a = ctx.createGain();
				o.frequency.value = f0 * ratio;
				const d = dec * (880 / f0) ** 0.5;
				a.gain.setValueAtTime(0, t);
				a.gain.linearRampToValueAtTime(g * vel, t + 0.004);
				a.gain.exponentialRampToValueAtTime(0.0001, t + d);
				o.connect(a).connect(out);
				o.start(t);
				o.stop(t + d + 0.05);
				end = Math.max(end, t + d + 0.05);
			}
			setTimeout(() => { voices--; out.disconnect(); }, (end - t) * 1000 + 100);
		},
		close() {
			ctx.close().catch(() => {});
		},
	};
}
