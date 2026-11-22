import { themes } from "./themes/themes.js";

const html = document.documentElement;

// Browsers cap live WebGL contexts (~16). Themes don't always release theirs, so flipping
// through many WebGL themes would exhaust the pool. Track every context and release them
// all whenever the theme changes.
const webglContexts = new Set();
for (const Canvas of [HTMLCanvasElement, globalThis.OffscreenCanvas].filter(Boolean)) {
	const getContext = Canvas.prototype.getContext;
	Canvas.prototype.getContext = function (type, ...rest) {
		const context = getContext.call(this, type, ...rest);
		if (/webgl/i.test(type)) {
			if (context) {
				webglContexts.add(context);
			} else {
				noteWebGLUnavailable();
			}
		}
		return context;
	};
}

let webglNoteShown = false;

function noteWebGLUnavailable() {
	if (webglNoteShown) {
		return;
	}
	webglNoteShown = true;
	queueMicrotask(() => {
		const note = document.createElement("p");
		note.className = "gallery-info-error";
		note.textContent =
			"⚠ The browser refused to create a WebGL context, so this theme falls back to its static scene. Reload the tab first; if it persists, Chrome has likely disabled WebGL after repeated GPU resets (check chrome://gpu) and restarting Chrome restores it.";
		document.getElementById("gallery-info")?.append(note);
		document.getElementById("gallery-info")?.removeAttribute("hidden");
	});
}

function releaseWebGLContexts() {
	for (const context of webglContexts) {
		try {
			if (!context.isContextLost()) {
				context.getExtension("WEBGL_lose_context")?.loseContext();
			}
		} catch {
			// Already gone.
		}
	}
	webglContexts.clear();
}
const frames = {
	site: document.getElementById("site"),
};
const pristine = {
	site: frames.site.innerHTML,
};
const pristineAttributes = Object.fromEntries(
	Object.entries(frames).map(([key, frame]) => [
		key,
		[...frame.attributes].map(({ name, value }) => [name, value]),
	]),
);
const pristineHtmlClasses = new Set(html.classList);

function restoreFrame(key) {
	const frame = frames[key];
	for (const { name } of [...frame.attributes]) {
		frame.removeAttribute(name);
	}
	for (const [name, value] of pristineAttributes[key]) {
		frame.setAttribute(name, value);
	}
	frame.innerHTML = pristine[key];
	frame.scrollTop = 0;
}

function restoreHtml() {
	for (const name of [...html.classList]) {
		if (!pristineHtmlClasses.has(name) && !["bar-hidden", "dark", "reduce-motion"].includes(name)) {
			html.classList.remove(name);
		}
	}
	html.removeAttribute("style");
	document.body.removeAttribute("style");
}

const themeLink = document.getElementById("theme-css");
const elements = {
	group: document.getElementById("current-group"),
	info: document.getElementById("gallery-info"),
	modeButton: document.getElementById("toggle-mode"),
	modeLabel: document.getElementById("mode-label"),
	motionLabel: document.getElementById("motion-label"),
	name: document.getElementById("current-name"),
	number: document.getElementById("current-number"),
	palette: document.getElementById("gallery-palette"),
	paletteInput: document.getElementById("palette-input"),
	paletteList: document.getElementById("palette-list"),
};

const params = new URLSearchParams(location.search);

const state = {
	cleanup: undefined,
	index: 0,
	mode: params.get("mode") ?? localStorage.getItem("gallery-mode") ?? "dark",
	reducedMotion:
		params.get("motion") === "reduced" ||
		(params.get("motion") !== "on" &&
			(localStorage.getItem("gallery-motion") === "reduced" ||
				matchMedia("(prefers-reduced-motion: reduce)").matches)),
	switching: 0,
};

if (params.get("bar") === "0") {
	html.classList.add("bar-hidden");
}

function findIndex(key) {
	if (!key) {
		return -1;
	}

	const number = Number.parseInt(key, 10);
	const index = themes.findIndex(
		(theme) => theme.id === key || theme.n === number,
	);
	return index;
}

function currentTheme() {
	return themes[state.index];
}

function effectiveMode(theme) {
	return theme.modes.includes(state.mode) ? state.mode : theme.modes[0];
}

async function activate(index) {
	const switching = ++state.switching;

	try {
		state.cleanup?.();
	} catch (error) {
		console.error("[gallery] cleanup failed:", error);
	}
	state.cleanup = undefined;
	releaseWebGLContexts();
	webglNoteShown = false;
	state.index = (index + themes.length) % themes.length;

	const theme = currentTheme();
	const mode = effectiveMode(theme);
	const frame = frames[theme.frame];

	history.replaceState(null, "", `${location.search}#${theme.n}-${theme.id}`);

	restoreHtml();
	restoreFrame("site");
	document.body.dataset.frame = theme.frame;
	html.dataset.theme = theme.id;
	html.classList.toggle("dark", mode === "dark");
	html.classList.toggle("reduce-motion", state.reducedMotion);

	elements.number.textContent = `#${theme.n}`;
	elements.name.textContent = theme.name;
	elements.group.textContent = theme.group;
	elements.modeLabel.textContent = mode === "dark" ? "Dark" : "Light";
	elements.modeButton.disabled = theme.modes.length < 2;
	elements.motionLabel.textContent = state.reducedMotion
		? "Reduced motion"
		: "Motion on";
	renderInfo(theme, mode);

	await new Promise((resolve) => {
		themeLink.onload = themeLink.onerror = resolve;
		themeLink.href = `themes/${theme.id}.css?v=${Date.now()}`;
	});

	if (switching !== state.switching) {
		return;
	}

	let module;
	try {
		module = await import(`./themes/${theme.id}.js?v=${Date.now()}`);
	} catch (error) {
		// CSS-only themes have no module; anything else is a real failure.
		if (!/Failed to fetch dynamically imported module|Importing a module script failed/.test(String(error))) {
			reportThemeError(theme, error);
		}
	}

	if (switching !== state.switching || !module?.activate) {
		return;
	}

	try {
		state.cleanup = module.activate({
			mode,
			reducedMotion: state.reducedMotion,
			root: frame,
			theme,
		});
	} catch (error) {
		reportThemeError(theme, error);
	}
}

const reportedErrors = new Set();

function reportThemeError(theme, error) {
	const key = `${theme.id}:${error?.message ?? error}`;
	if (reportedErrors.has(key)) {
		return;
	}
	reportedErrors.add(key);
	console.error(`[gallery] #${theme.n} ${theme.id} failed:`, error);
	const note = document.createElement("p");
	note.className = "gallery-info-error";
	note.textContent = `⚠ This theme threw an error: ${error?.message ?? error}`;
	elements.info.append(note);
	elements.info.hidden = false;
}

function renderInfo(theme, mode) {
	elements.info.innerHTML = "";

	const heading = document.createElement("h2");
	heading.textContent = `#${theme.n} ${theme.name}`;

	const meta = document.createElement("p");
	meta.className = "gallery-info-meta";
	meta.textContent = `${theme.group} · ${theme.frame} frame · ${theme.modes.join(" + ")} · showing ${mode}`;

	const blurb = document.createElement("p");
	blurb.textContent = theme.blurb;

	elements.info.append(heading, meta, blurb);
}

function setMode(mode) {
	state.mode = mode;
	localStorage.setItem("gallery-mode", mode);
	activate(state.index);
}

function setReducedMotion(reducedMotion) {
	state.reducedMotion = reducedMotion;
	localStorage.setItem("gallery-motion", reducedMotion ? "reduced" : "on");
	activate(state.index);
}

// Palette

let paletteSelection = 0;

function paletteMatches() {
	const query = elements.paletteInput.value.trim().toLowerCase();
	return themes.filter((theme) =>
		`${theme.n} ${theme.name} ${theme.group} ${theme.id}`
			.toLowerCase()
			.includes(query),
	);
}

function renderPalette() {
	const matches = paletteMatches();
	paletteSelection = Math.max(0, Math.min(paletteSelection, matches.length - 1));
	elements.paletteList.innerHTML = "";

	matches.forEach((theme, i) => {
		const item = document.createElement("li");
		item.role = "option";
		item.ariaSelected = String(i === paletteSelection);
		item.innerHTML = `<span class="palette-number">${theme.n}</span><span></span><span class="palette-group"></span>`;
		item.children[1].textContent = theme.name;
		item.children[2].textContent = theme.group;
		item.addEventListener("click", () => {
			closePalette();
			activate(themes.indexOf(theme));
		});
		item.addEventListener("mousemove", () => {
			if (paletteSelection !== i) {
				paletteSelection = i;
				renderPalette();
			}
		});
		elements.paletteList.append(item);
	});

	elements.paletteList
		.querySelector('[aria-selected="true"]')
		?.scrollIntoView({ block: "nearest" });
}

function openPalette() {
	elements.palette.hidden = false;
	elements.paletteInput.value = "";
	paletteSelection = state.index;
	renderPalette();
	elements.paletteInput.focus();
}

function closePalette() {
	elements.palette.hidden = true;
}

elements.paletteInput.addEventListener("input", () => {
	paletteSelection = 0;
	renderPalette();
});

elements.paletteInput.addEventListener("keydown", (event) => {
	const matches = paletteMatches();
	if (event.key === "ArrowDown" || event.key === "ArrowUp") {
		event.preventDefault();
		paletteSelection =
			(paletteSelection + (event.key === "ArrowDown" ? 1 : -1) + matches.length) %
			matches.length;
		renderPalette();
	} else if (event.key === "Enter" && matches[paletteSelection]) {
		closePalette();
		activate(themes.indexOf(matches[paletteSelection]));
	} else if (event.key === "Escape") {
		closePalette();
	}
	event.stopPropagation();
});

elements.palette.addEventListener("click", (event) => {
	if (event.target === elements.palette) {
		closePalette();
	}
});

// Controls

document.getElementById("prev").addEventListener("click", () => activate(state.index - 1));
document.getElementById("next").addEventListener("click", () => activate(state.index + 1));
document.getElementById("open-palette").addEventListener("click", openPalette);
elements.modeButton.addEventListener("click", () =>
	setMode(effectiveMode(currentTheme()) === "dark" ? "light" : "dark"),
);
document
	.getElementById("toggle-motion")
	.addEventListener("click", () => setReducedMotion(!state.reducedMotion));
document.getElementById("toggle-info").addEventListener("click", () => {
	elements.info.hidden = !elements.info.hidden;
});
document
	.getElementById("toggle-bar")
	.addEventListener("click", () => html.classList.toggle("bar-hidden"));

// Themes may claim keys by calling event.preventDefault() in their own listeners.
window.addEventListener("keydown", (event) => {
	if (event.defaultPrevented || !elements.palette.hidden) {
		return;
	}

	const target = event.target;
	if (
		target instanceof HTMLElement &&
		(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	) {
		return;
	}

	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		openPalette();
		return;
	}

	if (event.metaKey || event.ctrlKey || event.altKey) {
		return;
	}

	switch (event.key) {
		case "ArrowLeft":
			activate(state.index - 1);
			break;
		case "ArrowRight":
			activate(state.index + 1);
			break;
		case "t":
		case "T":
			event.preventDefault();
			openPalette();
			break;
		case "d":
		case "D":
			if (!elements.modeButton.disabled) {
				setMode(effectiveMode(currentTheme()) === "dark" ? "light" : "dark");
			}
			break;
		case "m":
		case "M":
			setReducedMotion(!state.reducedMotion);
			break;
		case "i":
		case "I":
			elements.info.hidden = !elements.info.hidden;
			break;
		case "h":
		case "H":
			html.classList.toggle("bar-hidden");
			break;
	}
});

// Errors thrown later (in rAF loops, timers, promises) are attributed to the current theme.
addEventListener("error", (event) => reportThemeError(currentTheme(), event.error ?? event.message));
addEventListener("unhandledrejection", (event) => reportThemeError(currentTheme(), event.reason));

const initial =
	findIndex(params.get("theme")) >= 0
		? findIndex(params.get("theme"))
		: Math.max(0, findIndex(location.hash.slice(1)));

activate(initial);
