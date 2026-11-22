import { bytesOf, el, formatBytes, formatMs, shortName, state, subscribe } from "./_perf/kit.js";

// FOIT / FOUT as a stage show, driven by real font loading:
//  - the "cast" is read from document.fonts (FontFaceSet) and Resource Timing for the font files;
//  - Replay really re-downloads the web font (fetch with cache: "reload"), builds a new FontFace from the
//    bytes, adds it to document.fonts, and swaps the page onto it. Download + decode times are measured;
//    the swap's width and height shift are measured with canvas.measureText and scrollHeight.
//  - The "block" pause before the fallback appears and the minimum fallback dwell are STAGED (labelled as such)
//    so a 20 ms download is still watchable.

const FALLBACK = 'Georgia, "Times New Roman", serif';
const BLOCK_MS = 700;
const DWELL_MS = 1500;

export function activate({ root, reducedMotion }) {
	const page = root.querySelector(".site-page");
	const title = root.querySelector(".site-title");
	const family = `Replay-${Math.random().toString(36).slice(2, 7)}`;

	const word = el("div", { class: "ft-word", text: "Josh Goldberg" });
	const curtainL = el("i", { class: "ft-curtain ft-l" });
	const curtainR = el("i", { class: "ft-curtain ft-r" });
	const light = el("i", { class: "ft-light" });
	const stage = el("div", { class: "ft-stage", "aria-hidden": "true" }, light, word, curtainL, curtainR);
	const acts = el("ol", { class: "ft-acts" });
	const cast = el("ul", { class: "ft-cast" });
	const replay = el("button", { class: "ft-replay", type: "button" }, "Replay the show");
	const card = el("div", { class: "ft-card", "data-phase": "idle" }, el("div", { class: "ft-title", text: "Font loading theatre" }), stage, acts, cast, replay);
	root.append(card);

	let timers = [];
	let abort;
	let fontFace;
	let running = false;

	const later = (ms, fn) => timers.push(setTimeout(fn, ms));
	const wait = (ms) => new Promise((resolve) => later(ms, resolve));
	const setPhase = (phase) => {
		card.dataset.phase = phase;
	};

	function renderActs(lines) {
		acts.replaceChildren(...lines.map(([label, text, done]) => el("li", { class: done ? "done" : "" }, el("b", { text: label }), ` ${text}`)));
	}

	function renderCast() {
		cast.replaceChildren();
		const faces = [...document.fonts].filter((face) => !face.family.startsWith("Replay-")).sort((a, b) => (b.status === "loaded") - (a.status === "loaded"));
		const seen = new Set();
		for (const face of faces) {
			const key = `${face.family}|${face.weight}|${face.style}`;
			if (seen.has(key)) continue;
			seen.add(key);
			if (seen.size > 3) break;
			cast.append(el("li", {}, `${face.family.replaceAll('"', "")} ${face.weight} `, el("em", { class: `st-${face.status}`, text: face.status })));
		}
		const fonts = state.resources.filter((entry) => /woff2?|ttf|otf|fonts\.gstatic/.test(entry.name));
		if (!seen.size) cast.append(el("li", {}, "No FontFace objects on this page yet"));
		for (const entry of fonts.slice(0, 2)) {
			cast.append(el("li", { class: "file" }, `${shortName(entry)} · ${formatBytes(bytesOf(entry))} · ${formatMs(entry.duration)}`));
		}
	}

	function measureTitle(fontFamily) {
		const ctx = measureTitle.ctx ?? (measureTitle.ctx = document.createElement("canvas").getContext("2d"));
		const cs = getComputedStyle(title);
		ctx.font = `${cs.fontWeight} ${cs.fontSize} ${fontFamily}`;
		return ctx.measureText(title.textContent).width;
	}

	async function findFontUrl() {
		// The page's CSS pulls League Spartan in unicode-range subsets; we want the latin one (it carries the ASCII glyphs).
		const css = await (await fetch("https://fonts.googleapis.com/css2?family=League+Spartan:wght@300..800&display=swap", { signal: abort.signal })).text();
		const latin = css.match(/\/\* latin \*\/\s*@font-face\s*\{[^}]*?url\((https:[^)]+)\)/);
		return latin?.[1] ?? css.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
	}

	function useFallback() {
		root.style.setProperty("--siteFont", FALLBACK);
		root.style.setProperty("--siteFontDisplay", FALLBACK);
	}

	function useWebFont() {
		root.style.setProperty("--siteFont", `"${family}", ${FALLBACK}`);
		root.style.setProperty("--siteFontDisplay", `"${family}", ${FALLBACK}`);
	}

	async function show() {
		if (running) return;
		running = true;
		abort = new AbortController();
		if (fontFace) {
			document.fonts.delete(fontFace);
			fontFace = undefined;
		}
		const lines = [];
		const push = (label, text, done = true) => {
			lines.push([label, text, done]);
			renderActs(lines);
		};

		try {
			// Act I: block period. Text is invisible (FOIT), curtain closed. Staged.
			setPhase("block");
			word.style.fontFamily = "inherit";
			useFallback();
			push("I. Block", `curtain down, text invisible (staged ${BLOCK_MS} ms; browsers use ~3 s)`, false);
			const url = await findFontUrl();
			if (!url) throw new Error("no font URL");
			const requestStarted = performance.now();
			const request = fetch(url, { cache: "reload", signal: abort.signal }).then(async (response) => {
				const buffer = await response.arrayBuffer();
				return { buffer, ms: performance.now() - requestStarted };
			});
			await wait(reducedMotion ? 0 : BLOCK_MS);

			// Act II: fallback shown (FOUT).
			const fallbackWidth = measureTitle(FALLBACK);
			const heightBefore = root.scrollHeight;
			setPhase("fallback");
			lines[0][2] = true;
			push("II. Fallback", "curtain up, system serif on stage (FOUT)", false);
			const [loaded] = await Promise.all([request, wait(reducedMotion ? 0 : DWELL_MS)]);

			// Act III: the real font arrives. Decode via FontFace, add to document.fonts, swap.
			const decodeStart = performance.now();
			fontFace = new FontFace(family, loaded.buffer, { display: "swap", weight: "300 800" });
			await fontFace.load();
			document.fonts.add(fontFace);
			const decodeMs = performance.now() - decodeStart;
			useWebFont();
			word.style.fontFamily = `"${family}", ${FALLBACK}`;
			await document.fonts.ready;
			const webWidth = measureTitle(`"${family}", ${FALLBACK}`);
			setPhase("swapped");
			lines[1][2] = true;
			// Layout after the swap: wait a frame so the new font is applied.
			await new Promise((resolve) => requestAnimationFrame(resolve));
			const heightAfter = root.scrollHeight;
			push("III. Swap", `${formatBytes(loaded.buffer.byteLength)} fetched in ${formatMs(loaded.ms)}, decoded in ${formatMs(decodeMs)}`);
			push("Cost", `headline ${Math.round(webWidth - fallbackWidth)} px width shift · page height ${heightAfter - heightBefore >= 0 ? "+" : ""}${Math.round(heightAfter - heightBefore)} px`);
			renderCast();
		} catch (error) {
			if (error?.name !== "AbortError") {
				useWebFont();
				useFallbackNote(error);
			}
		} finally {
			running = false;
		}
	}

	function useFallbackNote(error) {
		root.style.removeProperty("--siteFont");
		root.style.removeProperty("--siteFontDisplay");
		setPhase("swapped");
		renderActs([["!", `Could not re-fetch the font (${error?.message ?? "offline?"}); showing what the page already loaded.`, true]]);
	}

	replay.addEventListener("click", show);
	const unsubscribe = subscribe(() => {
		if (!running) renderCast();
	});

	renderActs([["Ready", "press replay to watch the web font arrive", true]]);
	renderCast();
	setPhase("swapped");
	if (!reducedMotion) later(300, show);

	return () => {
		unsubscribe();
		timers.forEach(clearTimeout);
		abort?.abort();
		if (fontFace) document.fonts.delete(fontFace);
		replay.removeEventListener("click", show);
	};
}
