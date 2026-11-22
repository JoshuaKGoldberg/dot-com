// 150: the page's own words, counted, become slow-drifting clouds of type sized by frequency.
import { hash, rng } from "./post-covers/lib.js";

const STOP = new Set("a about all also an and are as at be been but by can for from has have how i if in into is it its just more most my not of on one or our so than that the their them then there these they this to was we were what when which who will with you your i'm it's don't over out up new last".split(" "));

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const chip = root.querySelector(".overlay-b");
	const text = [...root.querySelectorAll(".site-main, .site-footer, .site-header")].map((n) => n.textContent).join(" ");
	const counts = new Map();
	for (const raw of text.toLowerCase().match(/\p{L}[\p{L}'-]+/gu) ?? []) {
		const w = raw.replace(/^['-]+|['-]+$/g, "");
		if (w.length < 4 || STOP.has(w) || /^\d/.test(w)) continue;
		counts.set(w, (counts.get(w) ?? 0) + 1);
	}
	const words = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 44);
	const max = words[0]?.[1] ?? 1;
	const total = [...counts.values()].reduce((a, b) => a + b, 0);
	const r = rng(hash("word-weather"));
	const frag = document.createDocumentFragment();
	const wrap = document.createElement("div");
	wrap.className = "ww-wrap";
	words.forEach(([word, n], i) => {
		const k = Math.pow(n / max, 0.6);
		const el = document.createElement("span");
		el.className = "ww-word";
		el.textContent = word;
		const size = 20 + k * 96;
		const depth = 1 - k * 0.5; // big words drift slower
		el.style.cssText = `--s:${size.toFixed(0)}px;--y:${(r() * 92).toFixed(1)}%;--dur:${((240 + r() * 200) * (1.4 - depth * 0.5)).toFixed(0)}s;--delay:-${(r() * 400).toFixed(0)}s;--sx:${(r() * 100).toFixed(0)}vw;--a:${(0.1 + k * 0.16).toFixed(2)}`;
		el.dataset.count = n;
		wrap.append(el);
	});
	frag.append(wrap);
	layer.append(frag);

	// forecast chip
	if (chip && words.length) {
		const [a, b, c] = words;
		const pct = (n) => Math.round((n / total) * 100);
		const el = document.createElement("div");
		el.className = "ww-chip";
		el.innerHTML = `<b>Forecast</b> mostly <em>${a[0]}</em> (${a[1]}), scattered <em>${b[0]}</em> (${b[1]}), chance of <em>${c[0]}</em> (${c[1]}) <span>· ${pct(a[1] + b[1] + c[1])}% of ${total} words</span>`;
		chip.append(el);
	}

	let frame = 0;
	const onScroll = () => {
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			wrap.style.setProperty("--scroll", String(root.scrollTop));
		});
	};
	if (!reducedMotion) root.addEventListener("scroll", onScroll, { passive: true });
	return () => {
		cancelAnimationFrame(frame);
		root.removeEventListener("scroll", onScroll);
	};
}
