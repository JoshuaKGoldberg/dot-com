const KINDS = {
	script: ["JS", "#ffd24a"],
	css: ["CSS", "#7aa7ff"],
	img: ["img", "#ff7ac6"],
	font: ["font", "#b28dff"],
	other: ["other", "#6fe0c8"],
};

const RATE = {
	fps: (v) => (v >= 55 ? "good" : v >= 30 ? "ni" : "poor"),
	lcp: (v) => (v <= 2500 ? "good" : v <= 4000 ? "ni" : "poor"),
	cls: (v) => (v <= 0.1 ? "good" : v <= 0.25 ? "ni" : "poor"),
	inp: (v) => (v <= 200 ? "good" : v <= 500 ? "ni" : "poor"),
};

const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} kB` : `${Math.round(n)} B`);
const ms = (n) => (n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`);

function kindOf(e) {
	const n = e.name.split("?")[0];
	if (e.initiatorType === "img" || /\.(png|jpe?g|webp|avif|gif|svg)$/.test(n)) return "img";
	if (e.initiatorType === "css" && /\.(woff2?|ttf|otf)$/.test(n)) return "font";
	if (/\.(woff2?|ttf|otf)$/.test(n) || /fonts\.gstatic/.test(n)) return "font";
	if (e.initiatorType === "script" || /\.m?js$/.test(n)) return "script";
	if (e.initiatorType === "link" || /\.css$/.test(n) || /fonts\.googleapis/.test(n)) return "css";
	return "other";
}

export function create(root, reduced, onClose) {
	let panel;
	let observers = [];
	let raf = 0;
	let timer = 0;
	let isOpen = false;

	const m = { lcp: undefined, fcp: undefined, cls: 0, inp: undefined, inpTarget: "", tbt: 0, longs: 0, frames: 0, fps: 0, worst: 0, hist: [] };
	const interactions = new Map();
	let windowValue = 0;
	let windowEntries = [];
	let lastSecond = 0;
	let lastFrame = 0;
	let secondWorst = 0;

	function observe(type, cb, extra = {}) {
		try {
			const po = new PerformanceObserver((list) => cb(list.getEntries()));
			po.observe({ type, buffered: true, ...extra });
			observers.push(po);
		} catch {}
	}

	function startObservers() {
		observe("largest-contentful-paint", (es) => { m.lcp = es.at(-1).startTime; });
		observe("paint", (es) => { for (const e of es) if (e.name === "first-contentful-paint") m.fcp = e.startTime; });
		observe("layout-shift", (es) => {
			for (const e of es) {
				if (e.hadRecentInput) continue;
				const first = windowEntries[0];
				const last = windowEntries.at(-1);
				if (windowEntries.length && e.startTime - last.startTime < 1000 && e.startTime - first.startTime < 5000) {
					windowValue += e.value;
					windowEntries.push(e);
				} else {
					windowValue = e.value;
					windowEntries = [e];
				}
				m.cls = Math.max(m.cls, windowValue);
			}
		});
		observe("event", (es) => {
			for (const e of es) {
				if (!e.interactionId) continue;
				const prev = interactions.get(e.interactionId);
				if (!prev || e.duration > prev.d) {
					interactions.set(e.interactionId, { d: e.duration, t: `${e.name} on ${e.target?.tagName?.toLowerCase?.() ?? "?"}` });
				}
			}
			const all = [...interactions.values()].sort((a, b) => b.d - a.d);
			if (all.length) {
				const pick = all[Math.min(all.length - 1, Math.floor(all.length / 50))];
				m.inp = pick.d;
				m.inpTarget = pick.t;
			}
		}, { durationThreshold: 16 });
		observe("longtask", (es) => {
			for (const e of es) { m.longs++; m.tbt += Math.max(0, e.duration - 50); }
		});
	}

	function tick(now) {
		raf = 0;
		if (!isOpen) return;
		m.frames++;
		if (lastFrame) secondWorst = Math.max(secondWorst, now - lastFrame);
		lastFrame = now;
		if (!lastSecond) lastSecond = now;
		if (now - lastSecond >= 1000) {
			m.fps = (m.frames * 1000) / (now - lastSecond);
			m.worst = secondWorst;
			m.hist.push(m.fps);
			if (m.hist.length > 60) m.hist.shift();
			m.frames = 0;
			secondWorst = 0;
			lastSecond = now;
			render();
		}
		raf = requestAnimationFrame(tick);
	}

	function resources() {
		const rs = performance.getEntriesByType("resource");
		const nav = performance.getEntriesByType("navigation")[0];
		const totals = { script: 0, css: 0, img: 0, font: 0, other: 0 };
		let sum = nav?.transferSize ?? 0;
		totals.other += nav?.transferSize ?? 0;
		const list = rs.map((e) => {
			const size = e.transferSize || e.encodedBodySize || 0;
			const k = kindOf(e);
			totals[k] += size;
			sum += size;
			return { name: e.name.replace(location.origin, "").replace(/^https?:\/\//, "").split("?")[0], size, dur: e.duration, k };
		});
		list.sort((a, b) => b.size - a.size);
		return { totals, sum, list, count: rs.length + 1, nav };
	}

	function html() {
		const tile = (id, label, hint) => `<div class="ph-tile"><div class="ph-lbl">${label}</div><span class="ph-val" id="ph-${id}" data-r="none">–</span><div class="ph-track"><i id="ph-${id}-m"></i></div><small id="ph-${id}-s">${hint}</small></div>`;
		return `<div class="ph-head"><span class="ph-dot"></span>PERF HUD <span class="ph-sub">this page · live</span><button type="button" aria-label="Close perf HUD">Esc ✕</button></div>
<div class="ph-fps"><div class="ph-row"><span class="ph-lbl">FPS</span><span class="ph-unit" id="ph-fps-s">worst frame –</span></div><div class="ph-row"><span class="ph-big" id="ph-fps" data-r="none">–</span><span class="ph-unit">frames / s</span></div>
<svg class="ph-spark" viewBox="0 0 240 38" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ph-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3ddc97" stop-opacity=".35"/><stop offset="1" stop-color="#3ddc97" stop-opacity="0"/></linearGradient></defs><path class="a" id="ph-area"/><path class="l" id="ph-line"/></svg></div>
<div class="ph-grid">${tile("lcp", "LCP", "largest paint")}${tile("cls", "CLS", "layout shift")}${tile("inp", "INP", "click or press a key")}</div>
<div class="ph-sect">RESOURCE BYTES <span id="ph-total" style="float:right;color:#dae7f3;font-family:ui-monospace,monospace"></span></div>
<div class="ph-bar" id="ph-bar"></div><div class="ph-legend" id="ph-legend"></div><ul class="ph-list" id="ph-list"></ul>
<div class="ph-extra" id="ph-extra"></div>`;
	}

	function setTile(id, value, rate, text, marker) {
		const el = panel.querySelector(`#ph-${id}`);
		el.textContent = text;
		el.dataset.r = value === undefined ? "none" : rate;
		const mk = panel.querySelector(`#ph-${id}-m`);
		mk.style.left = `${Math.min(97, marker * 100)}%`;
	}

	function render() {
		if (!panel) return;
		const q = (s) => panel.querySelector(s);
		q("#ph-fps").textContent = m.fps ? m.fps.toFixed(0) : "–";
		q("#ph-fps").dataset.r = m.fps ? RATE.fps(m.fps) : "none";
		q("#ph-fps-s").textContent = m.worst ? `worst frame ${m.worst.toFixed(0)} ms` : "measuring…";
		const h = m.hist;
		if (h.length > 1) {
			const pts = h.map((f, i) => [(i / 59) * 240, 36 - Math.min(f, 70) / 70 * 34]);
			const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
			q("#ph-line").setAttribute("d", line);
			q("#ph-area").setAttribute("d", `${line}L${pts.at(-1)[0]} 38L${pts[0][0]} 38Z`);
		}
		setTile("lcp", m.lcp, m.lcp !== undefined && RATE.lcp(m.lcp), m.lcp === undefined ? "–" : ms(m.lcp), (m.lcp ?? 0) / 5000);
		q("#ph-lcp-s").textContent = m.fcp ? `FCP ${ms(m.fcp)}` : "largest paint";
		setTile("cls", 0, RATE.cls(m.cls), m.cls.toFixed(3), m.cls / 0.3);
		q("#ph-cls-s").textContent = m.cls ? "since page load" : "no shifts ✓";
		setTile("inp", m.inp, m.inp !== undefined && RATE.inp(m.inp), m.inp === undefined ? "–" : ms(m.inp), (m.inp ?? 0) / 625);
		q("#ph-inp-s").textContent = m.inpTarget || "click or press a key";

		const r = resources();
		q("#ph-total").textContent = `${kb(r.sum)} · ${r.count} req`;
		q("#ph-bar").innerHTML = Object.entries(r.totals)
			.filter(([, v]) => v > 0)
			.map(([k, v]) => `<span style="flex-grow:${v};background:${KINDS[k][1]}" title="${KINDS[k][0]} ${kb(v)}"></span>`).join("");
		q("#ph-legend").innerHTML = Object.entries(r.totals)
			.filter(([, v]) => v > 0)
			.map(([k, v]) => `<span><b style="background:${KINDS[k][1]}"></b>${KINDS[k][0]} ${kb(v)}</span>`).join("");
		q("#ph-list").innerHTML = r.list.slice(0, 5)
			.map((e) => `<li><span title="${e.name}">${e.name}</span><span>${kb(e.size)}</span><span>${ms(e.dur)}</span></li>`).join("");
		const nav = r.nav;
		const heap = performance.memory ? `heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : "";
		q("#ph-extra").innerHTML = [
			nav ? `TTFB ${ms(nav.responseStart)}` : "",
			nav ? `DCL ${ms(nav.domContentLoadedEventEnd)}` : "",
			`long tasks ${m.longs}`,
			`TBT ${ms(m.tbt)}`,
			`${document.getElementsByTagName("*").length} DOM nodes`,
			heap,
		].filter(Boolean).map((t) => `<span>${t}</span>`).join("");
	}

	function dragify(head) {
		head.addEventListener("pointerdown", (e) => {
			if (e.target.closest("button")) return;
			const r = panel.getBoundingClientRect();
			const dx = e.clientX - r.left;
			const dy = e.clientY - r.top;
			head.setPointerCapture(e.pointerId);
			const move = (ev) => {
				panel.style.left = `${Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx))}px`;
				panel.style.top = `${Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy))}px`;
				panel.style.right = "auto";
			};
			head.addEventListener("pointermove", move);
			head.addEventListener("pointerup", () => head.removeEventListener("pointermove", move), { once: true });
		});
	}

	const api = {
		open() {
			if (isOpen) return;
			isOpen = true;
			panel = document.createElement("aside");
			panel.className = "ph";
			panel.setAttribute("aria-label", "Performance HUD");
			panel.innerHTML = html();
			root.append(panel);
			panel.querySelector("button").addEventListener("click", () => { api.close(); onClose(); });
			dragify(panel.querySelector(".ph-head"));
			startObservers();
			lastSecond = 0;
			lastFrame = 0;
			render();
			raf = requestAnimationFrame(tick);
			timer = setInterval(render, 1000);
		},
		close() {
			isOpen = false;
			cancelAnimationFrame(raf);
			clearInterval(timer);
			observers.forEach((o) => o.disconnect());
			observers = [];
			panel?.remove();
			panel = undefined;
			m.hist = [];
		},
		destroy() { api.close(); },
	};
	return api;
}
