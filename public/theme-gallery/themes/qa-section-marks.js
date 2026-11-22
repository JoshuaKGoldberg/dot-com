// #272 Section Marks: each section title gets a tiny hand-drawn ridge-and-aurora mark
// that draws itself once as it scrolls into view; the aurora strokes lean toward the cursor.
import { rng, noise1, trackPointer, idle } from "./_quiet-c/kit.js";

const W = 44;
const H = 22;

function markSvg(seed) {
	const r = rng(seed);
	// Hand-drawn ridge: a few jittered points joined by smooth curves.
	const pts = [];
	const n = 7;
	const peak = 2 + Math.floor(r() * 3);
	for (let i = 0; i < n; i++) {
		const x = 2 + (i / (n - 1)) * (W - 4);
		const bump = Math.max(0, 1 - Math.abs(i - peak) / 2.4);
		pts.push([x, H - 3 - 4 - bump * (7 + r() * 3) - noise1(i * 1.7, seed) * 3]);
	}
	let d = `M2 ${H - 3}L${pts[0][0]} ${pts[0][1].toFixed(1)}`;
	for (let i = 1; i < n; i++) {
		const [x0, y0] = pts[i - 1];
		const [x1, y1] = pts[i];
		d += `Q${((x0 + x1) / 2).toFixed(1)} ${(Math.min(y0, y1) - 1.2 + r() * 1.6).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
	}
	d += `L${W - 2} ${H - 3}`;
	const strokes = Array.from({ length: 4 }, (_, i) => {
		const x = 12 + i * 7 + r() * 3;
		return `<path class="qa-mark-aurora" style="--d:${(0.9 + i * 0.18).toFixed(2)}s" d="M${x.toFixed(1)} 9L${(x + 1).toFixed(1)} ${(1.5 + r() * 2).toFixed(1)}"/>`;
	}).join("");
	return `<svg class="qa-mark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><g class="qa-mark-sky">${strokes}</g><path class="qa-mark-ridge" pathLength="1" d="${d}"/></svg>`;
}

export function activate({ root, reducedMotion }) {
	const titles = [...root.querySelectorAll(".site-section-title")];
	const marks = titles.map((t, i) => {
		t.insertAdjacentHTML("beforeend", markSvg(272 + i * 31));
		const svg = t.lastElementChild;
		return svg;
	});
	if (reducedMotion) {
		marks.forEach((m) => m.classList.add("is-drawn"));
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					e.target.classList.add("is-drawn");
					io.unobserve(e.target);
					visible.add(e.target);
				}
			}
		},
		{ threshold: 0.6 },
	);
	const visible = new Set();
	let stopPtr = () => {};
	let raf = 0;
	let ptr;
	const cancel = idle(() => {
		marks.forEach((m) => io.observe(m));
		ptr = trackPointer();
		stopPtr = ptr.stop;
	});

	// Lean: only the aurora strokes of marks already drawn, throttled to pointer events.
	const onMove = (e) => {
		if (raf) return;
		raf = requestAnimationFrame(() => {
			raf = 0;
			for (const m of visible) {
				const rc = m.getBoundingClientRect();
				if (rc.bottom < 0 || rc.top > innerHeight) continue;
				const dx = e.clientX - (rc.left + rc.width / 2);
				const dy = e.clientY - (rc.top + rc.height / 2);
				const near = Math.exp(-(dx * dx + dy * dy) / (2 * 300 * 300));
				const lean = Math.max(-1, Math.min(1, dx / 400)) * 14;
				m.style.setProperty("--lean", `${lean.toFixed(1)}deg`);
				m.style.setProperty("--glow", (0.55 + near * 0.45).toFixed(2));
			}
		});
	};
	window.addEventListener("pointermove", onMove, { passive: true });

	return () => {
		cancel();
		io.disconnect();
		stopPtr();
		cancelAnimationFrame(raf);
		window.removeEventListener("pointermove", onMove);
		marks.forEach((m) => m.remove());
	};
}
