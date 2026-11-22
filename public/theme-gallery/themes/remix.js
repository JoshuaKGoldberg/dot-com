// Remix: a seeded, harmonious OKLCH palette whose lightness is nudged until
// body text passes 4.5:1 (we aim for 7:1 where the hue allows it).
const DEFAULT_SEED = "7f3a2c";
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function mulberry32(a) {
	return () => {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function oklchToLinear(L, C, hDeg) {
	const h = (hDeg * Math.PI) / 180;
	const a = C * Math.cos(h), b = C * Math.sin(h);
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;
	const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}
const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
const encode = (v) => { v = clamp01(v); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; };

// Returns { hex, lum } with chroma reduced until the colour fits in sRGB.
function color(L, C, h) {
	let c = C, lin = oklchToLinear(L, c, h);
	while (!inGamut(lin) && c > 0) { c = Math.max(0, c - 0.005); lin = oklchToLinear(L, c, h); }
	const hex = "#" + lin.map((v) => Math.round(encode(v) * 255).toString(16).padStart(2, "0")).join("");
	const [r, g, b] = lin.map(clamp01);
	return { hex, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}
const ratio = (a, b) => { const [x, y] = [a.lum, b.lum].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Move L away from the background until the ratio target is met.
function fit(bg, L, C, h, target, dark) {
	let col = color(L, C, h), tries = 0;
	while (ratio(col, bg) < target && tries++ < 100) {
		L = dark ? Math.min(1, L + 0.01) : Math.max(0, L - 0.01);
		col = color(L, C, h);
	}
	return { ...col, ratio: ratio(col, bg), L };
}

export function makePalette(seed, dark) {
	const rng = mulberry32(parseInt(seed, 16) || 1);
	const hue = rng() * 360;
	const schemes = [
		["Analogous", 32, -32], ["Complementary", 180, 150], ["Triadic", 120, 240], ["Split-complementary", 150, 210], ["Tetradic", 90, 270],
	];
	const [scheme, off1, off2] = schemes[Math.floor(rng() * schemes.length)];
	const bgC = 0.012 + rng() * 0.03;
	const bg = color(dark ? 0.155 + rng() * 0.05 : 0.955 + rng() * 0.03, bgC, hue);
	const fg = fit(bg, dark ? 0.9 : 0.3, 0.03, hue, 7, dark);
	const strong = fit(bg, dark ? 0.97 : 0.2, 0.025, hue, 10, dark);
	const muted = fit(bg, dark ? 0.72 : 0.5, 0.04, hue, 4.6, dark);
	const accent = fit(bg, dark ? 0.78 : 0.46, 0.17 + rng() * 0.04, (hue + off1 + 360) % 360, 4.6, dark);
	const squiggle = color(dark ? 0.72 : 0.62, 0.17, (hue + off2) % 360);
	const subtle = color(dark ? 0.155 + 0.07 : 0.955 - 0.06, bgC + 0.012, hue);
	return {
		scheme, hue: Math.round(hue),
		tokens: { "--siteBg": bg.hex, "--siteFg": fg.hex, "--siteFgStrong": strong.hex, "--siteMuted": muted.hex, "--siteAccent": accent.hex, "--siteSquiggle": squiggle.hex, "--siteSubtle": subtle.hex },
		ratio: fg.ratio, accentRatio: accent.ratio, mutedRatio: muted.ratio,
	};
}

const randomSeed = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	let seed = DEFAULT_SEED;
	const param = new URLSearchParams(location.search).get("remix");
	if (param && /^[0-9a-f]{1,8}$/i.test(param)) seed = param.toLowerCase();
	const initialSearch = location.search;
	const startedFromUrl = Boolean(param);

	const header = root.querySelector(".site-header");
	const bar = document.createElement("div");
	bar.className = "rx-bar";
	bar.innerHTML = `
		<button type="button" class="rx-remix"><span aria-hidden="true">⟳</span> Remix</button>
		<span class="rx-swatches" aria-hidden="true"></span>
		<span class="rx-info"><code class="rx-seed"></code><small class="rx-scheme"></small></span>
		<button type="button" class="rx-copy" title="Copy a link to this palette">Copy link</button>
		<button type="button" class="rx-reset" title="Back to the default palette">Reset</button>
		<span class="rx-live" role="status" aria-live="polite"></span>`;
	header.after(bar);
	const q = (s) => bar.querySelector(s);

	const setUrl = (value) => {
		const url = new URL(location.href);
		if (value) url.searchParams.set("remix", value); else url.searchParams.delete("remix");
		history.replaceState(null, "", url.pathname + url.search + url.hash);
	};

	const show = (s) => {
		const pal = makePalette(s, dark);
		for (const [k, v] of Object.entries(pal.tokens)) root.style.setProperty(k, v);
		q(".rx-seed").textContent = `seed: ${s}`;
		q(".rx-scheme").textContent = `${pal.scheme} · hue ${pal.hue}° · body ${pal.ratio.toFixed(1)}:1`;
		q(".rx-swatches").innerHTML = ["--siteBg", "--siteSubtle", "--siteMuted", "--siteAccent", "--siteSquiggle", "--siteFg"]
			.map((k) => `<i style="background:${pal.tokens[k]}"></i>`).join("");
		seed = s;
		return pal;
	};
	show(seed);
	if (startedFromUrl) setUrl(seed);

	q(".rx-remix").addEventListener("click", () => { const s = randomSeed(); show(s); setUrl(s); q(".rx-live").textContent = ""; });
	q(".rx-reset").addEventListener("click", () => {
		show(DEFAULT_SEED); setUrl(null); q(".rx-live").textContent = "Reset";
		setTimeout(() => (q(".rx-live").textContent = ""), 1400);
	});
	q(".rx-copy").addEventListener("click", async () => {
		const url = new URL(location.href);
		url.searchParams.set("remix", seed);
		const text = url.toString();
		let ok = false;
		try { await navigator.clipboard.writeText(text); ok = true; } catch {
			const ta = Object.assign(document.createElement("textarea"), { value: text });
			document.body.append(ta); ta.select();
			try { ok = document.execCommand("copy"); } catch { ok = false; }
			ta.remove();
		}
		q(".rx-live").textContent = ok ? "Link copied" : `?remix=${seed}`;
		setTimeout(() => (q(".rx-live").textContent = ""), 2200);
	});

	const onKey = (e) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
		if (!typing && (e.key === "r" || e.key === "R")) { e.preventDefault(); q(".rx-remix").click(); }
	};
	document.addEventListener("keydown", onKey);

	return () => {
		for (const k of ["--siteBg", "--siteFg", "--siteFgStrong", "--siteMuted", "--siteAccent", "--siteSquiggle", "--siteSubtle"]) root.style.removeProperty(k);
		document.removeEventListener("keydown", onKey);
		// leave no ?remix param behind for other themes
		const url = new URL(location.href);
		if (url.searchParams.has("remix") && !startedFromUrl) { url.searchParams.delete("remix"); history.replaceState(null, "", url.pathname + url.search + url.hash); }
		else if (url.searchParams.has("remix")) { url.searchParams.delete("remix"); history.replaceState(null, "", url.pathname + url.search + url.hash); }
	};
}
