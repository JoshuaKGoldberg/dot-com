const KEYS = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="9" width="16" height="8" rx="2"/><path d="M5 9V4h10v5M6 13h8"/></svg>';
const SPEAKER = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8v4h3l4 3V5L6 8z"/><path class="tw-waves" d="M13 7.5a3.5 3.5 0 010 5M15.5 5a7 7 0 010 10"/></svg>';

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	let on = false;
	let sound = false;

	const chip = document.createElement("div");
	chip.className = "dx-chip";
	chip.innerHTML = `<button type="button" class="tw-toggle" aria-pressed="false" title="Re-type the page with a typewriter (R). Esc finishes it instantly.">${KEYS}<span>re-type</span><kbd>R</kbd></button><button type="button" class="tw-sound" aria-pressed="false" title="Typewriter clacks (off by default)">${SPEAKER}<span>sound off</span></button>`;
	root.append(chip);
	const [toggleBtn, soundBtn] = chip.children;

	const load = () => (loading ??= import(`./typewriter/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion, () => {
		on = false;
		paint();
	}))));

	function paint() {
		toggleBtn.setAttribute("aria-pressed", String(on));
		toggleBtn.querySelector("span").textContent = on ? "restore" : "re-type";
		soundBtn.setAttribute("aria-pressed", String(sound));
		soundBtn.querySelector("span").textContent = sound ? "sound on" : "sound off";
		soundBtn.querySelector(".tw-waves").style.opacity = sound ? 1 : 0.25;
	}

	async function toggle() {
		const e = await load();
		on = !on;
		paint();
		on ? e.start() : e.stop();
	}

	toggleBtn.addEventListener("click", toggle);
	soundBtn.addEventListener("click", async () => {
		sound = !sound;
		paint();
		(await load()).setSound(sound);
	});

	const onKey = (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.key.toLowerCase() === "r" && !event.repeat) {
			event.preventDefault();
			toggle();
		} else if (event.key === "Escape" && engine?.typing) {
			engine.skip();
		}
	};
	window.addEventListener("keydown", onKey);
	paint();

	return () => {
		window.removeEventListener("keydown", onKey);
		engine?.destroy();
	};
}
