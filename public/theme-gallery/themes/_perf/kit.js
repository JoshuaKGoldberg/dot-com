// Shared, real performance measurements for the "Performance as art" themes (156-165).
// Observers start on the first subscribe() and disconnect on the last unsubscribe().
// All observers are `buffered`, so a late subscriber still sees everything that already happened.

export const THRESHOLDS = {
	lcp: [2500, 4000],
	fcp: [1800, 3000],
	cls: [0.1, 0.25],
	inp: [200, 500],
	tbt: [200, 600],
};

export function rate(metric, value) {
	if (value == null) return "pending";
	const [good, poor] = THRESHOLDS[metric];
	return value <= good ? "good" : value <= poor ? "needs-work" : "poor";
}

export const state = {
	resources: [],
	paints: {},
	lcp: undefined, // { time, size, element }
	cls: 0,
	shifts: [],
	inp: undefined, // ms
	interactions: 0,
	longTasks: [],
	nav: undefined,
};

const listeners = new Set();
let observers = [];
let scheduled = false;

function notify() {
	if (scheduled) return;
	scheduled = true;
	// Coalesce bursts of entries into one update per frame-ish.
	setTimeout(() => {
		scheduled = false;
		for (const fn of listeners) fn(state);
	}, 60);
}

function observe(type, handler, extra = {}) {
	try {
		const observer = new PerformanceObserver((list) => {
			handler(list.getEntries());
			notify();
		});
		observer.observe({ type, buffered: true, ...extra });
		observers.push(observer);
	} catch {
		// Entry type unsupported in this browser: that metric simply stays pending.
	}
}

function reset() {
	state.resources = [];
	state.paints = {};
	state.lcp = undefined;
	state.cls = 0;
	state.shifts = [];
	state.inp = undefined;
	state.interactions = 0;
	state.longTasks = [];
	state.nav = performance.getEntriesByType("navigation")[0];
}

const interactionMax = new Map();

function start() {
	reset();
	interactionMax.clear();
	observe("resource", (entries) => state.resources.push(...entries));
	observe("paint", (entries) => {
		for (const entry of entries) state.paints[entry.name] = entry.startTime;
	});
	observe("largest-contentful-paint", (entries) => {
		const last = entries.at(-1);
		state.lcp = { time: last.startTime, size: last.size, element: last.element, url: last.url };
	});
	observe("layout-shift", (entries) => {
		for (const entry of entries) {
			if (!entry.hadRecentInput) {
				state.cls += entry.value;
				state.shifts.push({ time: entry.startTime, value: entry.value });
			}
		}
	});
	observe(
		"event",
		(entries) => {
			for (const entry of entries) {
				if (!entry.interactionId) continue;
				const prev = interactionMax.get(entry.interactionId) ?? 0;
				interactionMax.set(entry.interactionId, Math.max(prev, entry.duration));
			}
			const all = [...interactionMax.values()].sort((a, b) => b - a);
			state.interactions = all.length;
			// INP: the worst interaction, or ~p98 once there are more than 50.
			state.inp = all.length ? all[Math.min(all.length - 1, Math.floor(all.length / 50))] : undefined;
		},
		{ durationThreshold: 16 },
	);
	observe("longtask", (entries) => state.longTasks.push(...entries));
}

function stop() {
	for (const observer of observers) observer.disconnect();
	observers = [];
}

/** Subscribe to measurement updates; returns an unsubscribe. Calls back once soon after subscribing. */
export function subscribe(fn) {
	if (listeners.size === 0) start();
	listeners.add(fn);
	notify();
	return () => {
		listeners.delete(fn);
		if (listeners.size === 0) stop();
	};
}

// ---- classification -------------------------------------------------------

/** Start time of the first theme asset: everything before is "page load", everything after is "theme load". */
export function themeBoundary() {
	let boundary = Infinity;
	for (const entry of state.resources) {
		if (/\/themes\/(?!themes\.js)/.test(entry.name) && entry.startTime < boundary) boundary = entry.startTime;
	}
	return boundary;
}

export function origin(entry, boundary = themeBoundary()) {
	return entry.startTime >= boundary ? "theme" : "page";
}

export function typeOf(entry) {
	const path = entry.name.split("?")[0];
	if (/\.(woff2?|ttf|otf)$/.test(path) || /fonts\.gstatic/.test(entry.name)) return "font";
	if (/\.(png|jpe?g|webp|avif|gif|svg|ico)$/.test(path) || entry.initiatorType === "img") return "image";
	if (/\.(m?js)$/.test(path) || entry.initiatorType === "script") return "script";
	if (/\.css$/.test(path) || /fonts\.googleapis\.com\/css/.test(entry.name) || entry.initiatorType === "css" && !/\.(woff2?|svg|png|webp)/.test(path)) return "style";
	if (/\.(json|wasm)$/.test(path) || entry.initiatorType === "fetch" || entry.initiatorType === "xmlhttprequest") return "data";
	return "other";
}

export function shortName(entry) {
	try {
		const url = new URL(entry.name);
		const file = url.pathname.split("/").filter(Boolean).pop() || url.host;
		return file.length > 28 ? `${file.slice(0, 25)}...` : file;
	} catch {
		return entry.name.slice(0, 28);
	}
}

/** Best available byte size. Cross-origin entries without Timing-Allow-Origin report 0 (opaque). */
export function bytesOf(entry) {
	return entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0;
}

export function formatBytes(bytes) {
	if (!bytes) return "opaque";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMs(ms) {
	if (ms == null) return "-";
	return ms < 10 ? `${ms.toFixed(1)} ms` : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

// ---- Lighthouse-style score ------------------------------------------------

function erf(x) {
	const sign = Math.sign(x);
	x = Math.abs(x);
	const t = 1 / (1 + 0.3275911 * x);
	const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
	return sign * y;
}

// Same log-normal curve Lighthouse uses (median / p10 control points, v10 mobile-ish).
function logNormalScore({ median, p10 }, value) {
	if (value <= p10) return 1;
	const xLogRatio = Math.log(Math.max(Number.MIN_VALUE, value / median));
	const p10LogRatio = -Math.log(Math.max(Number.MIN_VALUE, p10 / median));
	const standardized = (xLogRatio * 0.9061938024368232) / p10LogRatio;
	return Math.min(1, Math.max(0, (1 - erf(standardized)) / 2));
}

export function totalBlockingTime() {
	const fcp = state.paints["first-contentful-paint"] ?? 0;
	let tbt = 0;
	for (const task of state.longTasks) {
		if (task.startTime + task.duration > fcp) tbt += Math.max(0, task.duration - 50);
	}
	return tbt;
}

/** Score 0-100 from FCP, LCP, TBT and CLS (weights 10/25/30/25, renormalised). Null until FCP exists. */
export function lighthouseScore() {
	const fcp = state.paints["first-contentful-paint"];
	if (fcp == null) return undefined;
	const lcp = state.lcp?.time ?? fcp;
	const tbt = totalBlockingTime();
	const parts = [
		{ key: "FCP", value: fcp, weight: 10, score: logNormalScore({ median: 3000, p10: 1800 }, fcp), label: formatMs(fcp) },
		{ key: "LCP", value: lcp, weight: 25, score: logNormalScore({ median: 4000, p10: 2500 }, lcp), label: formatMs(lcp) },
		{ key: "TBT", value: tbt, weight: 30, score: logNormalScore({ median: 600, p10: 200 }, tbt), label: formatMs(tbt) },
		{ key: "CLS", value: state.cls, weight: 25, score: logNormalScore({ median: 0.25, p10: 0.1 }, state.cls), label: state.cls.toFixed(3) },
	];
	const total = parts.reduce((sum, part) => sum + part.weight, 0);
	const score = Math.round((parts.reduce((sum, part) => sum + part.score * part.weight, 0) / total) * 100);
	return { score, parts };
}

// ---- tiny DOM helpers ------------------------------------------------------

export function el(tag, props = {}, ...children) {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(props)) {
		if (key === "class") node.className = value;
		else if (key === "text") node.textContent = value;
		else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
		else node.setAttribute(key, value);
	}
	node.append(...children);
	return node;
}

export function svg(tag, props = {}, ...children) {
	const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
	for (const [key, value] of Object.entries(props)) node.setAttribute(key, value);
	node.append(...children);
	return node;
}

/** Fit a canvas to a layer at DPR <= 1.5, returning a 2d context scaled to CSS pixels. */
export function mountCanvas2d(layer) {
	const canvas = el("canvas", { "aria-hidden": "true" });
	Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
	layer.append(canvas);
	const ctx = canvas.getContext("2d");
	const api = { canvas, ctx, w: 0, h: 0 };
	api.fit = () => {
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		api.w = Math.max(2, layer.clientWidth);
		api.h = Math.max(2, layer.clientHeight);
		canvas.width = Math.round(api.w * dpr);
		canvas.height = Math.round(api.h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	api.fit();
	return api;
}
