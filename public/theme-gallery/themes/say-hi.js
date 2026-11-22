import { panel, h } from "./_sensor/kit.js";

const SECTIONS = [
	[/\b(projects?|open source|work)\b/, ".site-projects", "Projects"],
	[/\b(speaking|talks?|conferences?)\b/, ".site-talks", "Speaking"],
	[/\b(writing|blog|posts?|articles?)\b/, ".site-posts", "Writing"],
];

export function activate({ root, reducedMotion }) {
	const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
	const heroText = root.querySelector(".site-hero-text");
	const portrait = root.querySelector(".site-portrait");
	const hand = h("span", { class: "sh-wave", "aria-hidden": "true" }, h("span", { class: "sh-hand" }, "👋"));
	const bubble = h("span", { class: "sh-bubble", "aria-hidden": "true" }, "Hi there!");
	heroText.prepend(hand, bubble);
	const caption = h("div", { class: "sh-caption", "aria-hidden": "true" });
	root.append(caption);
	const timers = new Set();
	const later = (fn, ms) => {
		const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
		timers.add(t);
	};

	function wave() {
		hand.classList.remove("is-on");
		void hand.offsetWidth; // restart the one-shot animation
		hand.classList.add("is-on");
		bubble.classList.add("is-on");
		portrait.classList.add("is-nod");
		later(() => { hand.classList.remove("is-on"); bubble.classList.remove("is-on"); portrait.classList.remove("is-nod"); }, 3200);
	}
	const goto = (selector) => {
		const el = root.querySelector(selector);
		if (el) root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 24, behavior: reducedMotion ? "auto" : "smooth" });
	};

	/** Returns a short description of what happened, or "" if the phrase wasn't a command. */
	function command(raw) {
		const s = raw.toLowerCase();
		if (/\b(stop listening|stop)\b/.test(s)) { stop(); return "Stopped listening"; }
		if (/\b(hi|hello|hey|howdy|hiya)\b/.test(s)) { wave(); return "Waving back"; }
		for (const [re, sel, name] of SECTIONS) if (re.test(s)) { goto(sel); return `Going to ${name}`; }
		if (/\b(top|home|start)\b/.test(s)) { root.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }); return "Going to the top"; }
		if (/\b(bottom|footer|end)\b/.test(s)) { root.scrollTo({ top: root.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" }); return "Going to the bottom"; }
		if (/\bscroll down\b|\bdown\b/.test(s)) { root.scrollBy({ top: 420, behavior: reducedMotion ? "auto" : "smooth" }); return "Scrolling down"; }
		if (/\bscroll up\b|\bup\b/.test(s)) { root.scrollBy({ top: -420, behavior: reducedMotion ? "auto" : "smooth" }); return "Scrolling up"; }
		return "";
	}
	let capTimer;
	function say(heard, result, interim) {
		caption.replaceChildren(h("span", { class: "sh-dot" }), `"${heard}"${result ? ` → ${result}` : interim ? "…" : ""}`);
		caption.classList.add("is-on");
		clearTimeout(capTimer);
		capTimer = setTimeout(() => caption.classList.remove("is-on"), 2600);
		ui.status(result ? `Heard "${heard}": ${result}.` : `Heard "${heard}". Try "hi", "projects", "speaking", "top".`);
	}

	const ui = panel(root, {
		title: "Say hi",
		statusIdle: SR ? "Say hi to the page. Off until you press the button." : "Speech recognition isn't supported here. Type a phrase instead.",
		privacy: "Nothing is recorded or stored by this page. Note: in some browsers (Chrome) speech is transcribed by the browser's own service.",
		enable: SR ? { label: "Start listening", run: enable } : undefined,
		stopLabel: "Stop listening",
		onStop: stop,
		simLabel: "Type instead",
		controls: [
			{ type: "text", id: "say", label: "Pretend you said…", placeholder: "hi / projects / top", button: "Say", onSubmit: (v) => say(v, command(v)) },
			{ type: "buttons", id: "q", label: "Quick phrases", value: "", options: ["hi", "projects", "speaking", "top"].map((v) => ({ value: v, label: v })), onPick: (v) => say(v, command(v)) },
		],
	});

	let rec, wanted = false, handledInterim = false;
	async function enable() {
		rec = new SR();
		rec.continuous = true;
		rec.interimResults = true;
		rec.lang = navigator.language || "en-US";
		rec.onresult = (e) => {
			for (let i = e.resultIndex; i < e.results.length; i++) {
				const r = e.results[i];
				const text = r[0].transcript.trim();
				if (r.isFinal) {
					handledInterim = false;
					say(text, command(text) );
				} else if (!handledInterim && /\b(hi|hello|hey)\b/i.test(text)) {
					handledInterim = true; // respond quickly to a greeting without waiting for the final result
					say(text, command(text));
				} else if (!handledInterim) say(text, "", true);
			}
		};
		rec.onerror = (e) => {
			if (e.error === "not-allowed" || e.error === "service-not-allowed") {
				ui.status("Microphone or speech access was blocked. Use the typed phrases instead.");
				stop();
			} else if (e.error === "network") {
				ui.status("The browser's speech service is unreachable. Use the typed phrases instead.");
				stop();
			}
		};
		rec.onend = () => {
			handledInterim = false;
			if (wanted) {
				try { rec.start(); } catch { /* already started */ }
			}
		};
		wanted = true;
		rec.start();
		ui.setActive(true);
		ui.status('Listening. Say "hi", "projects", "speaking" or "top".');
	}
	function stop() {
		wanted = false;
		try { rec?.abort(); } catch { /* ignore */ }
		rec = undefined;
		ui.setActive(false);
		ui.status("Stopped. Say hi to the page. Off until you press the button.");
	}

	return () => {
		wanted = false;
		try { rec?.abort(); } catch { /* ignore */ }
		timers.forEach(clearTimeout);
		clearTimeout(capTimer);
		caption.remove();
		ui.destroy();
	};
}
