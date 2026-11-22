import { createKit } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const heads = [...root.querySelectorAll(".site-title, .site-section-title")];
	const letters = [];
	for (const el of heads) {
		const text = el.textContent;
		el.setAttribute("aria-label", text);
		el.textContent = "";
		const strong = el.classList.contains("site-title");
		for (const part of text.split(/(\s+)/)) {
			if (/^\s+$/.test(part)) {
				el.append(" ");
				continue;
			}
			const word = document.createElement("span");
			word.className = "kt-word";
			word.setAttribute("aria-hidden", "true");
			for (const ch of part) {
				const s = document.createElement("span");
				s.className = "kt-ch";
				s.textContent = ch;
				word.append(s);
				letters.push({ s, p: 0, target: 0, cx: 0, pageY: 0, radius: strong ? 210 : 150 });
			}
			el.append(word);
		}
	}
	const rate = reducedMotion ? 1000 : 9;

	function measure() {
		for (const l of letters) l.s.style.setProperty("--p", "0");
		for (const l of letters) {
			const r = l.s.getBoundingClientRect();
			l.cx = r.left + r.width / 2;
			l.pageY = r.top + r.height / 2 + root.scrollTop;
		}
		for (const l of letters) l.s.style.setProperty("--p", l.p.toFixed(3));
	}

	function aim(k) {
		let cx = k.x + k.ox;
		let cy = k.y + k.oy;
		if (!k.active) {
			const r = heads[0].getBoundingClientRect();
			cx = r.left + r.width * 0.62;
			cy = r.top + r.height * 0.5;
		}
		const sy = root.scrollTop;
		for (const l of letters) {
			const dx = l.cx - cx;
			const dy = l.pageY - sy - cy;
			const d2 = (dx * dx + dy * dy) / (l.radius * l.radius);
			l.target = Math.exp(-d2 * 1.4);
		}
	}

	let busyFlag = false;
	const kit = createKit({
		root,
		reducedMotion,
		canvas: false,
		follow: 16,
		step(k, dt) {
			aim(k);
			const a = 1 - Math.exp(-dt * rate);
			busyFlag = false;
			for (const l of letters) {
				const d = l.target - l.p;
				if (Math.abs(d) < 0.003) l.p = l.target;
				else {
					l.p += d * a;
					busyFlag = true;
				}
			}
			return busyFlag;
		},
		draw() {
			for (const l of letters) l.s.style.setProperty("--p", l.p.toFixed(3));
		},
		onResize() {},
		onScroll: (k) => aim(k),
	});

	let cancelled = false;
	const settle = () => {
		if (cancelled) return;
		measure();
		aim(kit.k);
		for (const l of letters) l.p = l.target;
		kit.k.redraw();
	};
	document.fonts.ready.then(settle);
	const ro = new ResizeObserver(() => settle());
	ro.observe(root);

	return () => {
		cancelled = true;
		ro.disconnect();
		kit.destroy();
	};
}
