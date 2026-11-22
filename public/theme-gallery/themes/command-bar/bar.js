const EMAIL = "git@joshuakgoldberg.com";
const KINDS = { "site-post": "Post", "site-project": "Project", "site-talk": "Talk" };

// Subsequence fuzzy match with bonuses for consecutive runs and word starts.
export function fuzzy(query, text) {
	const q = query.toLowerCase();
	const s = text.toLowerCase();
	let score = 0, pos = -1, run = 0;
	const idx = [];
	for (const ch of q) {
		if (ch === " ") {
			run = 0;
			continue;
		}
		const next = s.indexOf(ch, pos + 1);
		if (next < 0) return null;
		const wordStart = next === 0 || /[\s\-_/.:,(]/.test(s[next - 1]);
		run = next === pos + 1 ? run + 1 : 0;
		score += 1 + (wordStart ? 6 : 0) + run * 4 - Math.min(5, (next - pos - 1) * 0.35);
		idx.push(next);
		pos = next;
	}
	if (s.includes(q.trim())) score += 12;
	return { score: score - s.length * 0.02, idx };
}

export function create({ root, reducedMotion }) {
	const html = document.documentElement;
	const dlg = document.createElement("dialog");
	dlg.className = "cb-dialog";
	dlg.setAttribute("aria-label", "Command bar");
	dlg.innerHTML =
		'<div class="cb-box"><div class="cb-inputrow"><span aria-hidden="true">⌕</span><input class="cb-input" type="text" placeholder="Search posts, projects, talks, or type a command…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="cb-list" /></div>' +
		'<ul class="cb-list" id="cb-list" role="listbox"></ul>' +
		'<div class="cb-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> choose</span><span><kbd>esc</kbd> close</span></div></div>';
	const toast = document.createElement("div");
	toast.className = "cb-toast";
	toast.setAttribute("role", "status");
	root.append(dlg, toast);
	const input = dlg.querySelector(".cb-input");
	const list = dlg.querySelector(".cb-list");

	const toggles = new Set();
	const classToggle = (name, cls, label, icon) => ({
		kind: "Effect", icon, title: name, hint: label,
		on: () => toggles.has(cls),
		run: () => {
			const on = !toggles.has(cls);
			on ? toggles.add(cls) : toggles.delete(cls);
			root.classList.toggle(cls, on);
			return false; // stay open
		},
	});
	const sectionJump = (sel, title, icon) => ({
		kind: "Jump", icon, title, hint: "Scroll to section",
		run: () => go(root.querySelector(sel)),
	});

	function go(el) {
		if (!el) return;
		el.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
		el.classList.remove("cb-flash");
		void el.offsetWidth;
		el.classList.add("cb-flash");
		setTimeout(() => el.classList.remove("cb-flash"), 2200);
	}
	function say(msg) {
		toast.textContent = msg;
		toast.classList.remove("is-on");
		void toast.offsetWidth;
		toast.classList.add("is-on");
	}
	async function copyEmail() {
		try {
			await navigator.clipboard.writeText(EMAIL);
		} catch {
			const ta = document.createElement("textarea");
			ta.value = EMAIL;
			ta.style.cssText = "position:fixed;opacity:0";
			document.body.append(ta);
			ta.select();
			document.execCommand("copy");
			ta.remove();
		}
		say(`Copied ${EMAIL}`);
	}
	let confetti = null;
	async function emojiBlast() {
		confetti ??= (await import("./blast.js")).blast;
		confetti(root, reducedMotion);
	}

	const commands = [
		{ kind: "Action", icon: "✉", title: "Copy email address", hint: EMAIL, run: copyEmail },
		{ kind: "Action", icon: "✨", title: "Emoji blast", hint: "A little burst of joy", run: emojiBlast },
		classToggle("Wiggle squiggles", "cb-wiggle", "Animate the link underlines", "〰"),
		classToggle("Serif mode", "cb-serif", "Swap in a bookish typeface", "Aa"),
		classToggle("Big type", "cb-big", "Bump the text size", "A+"),
		classToggle("Reading ruler", "cb-ruler", "Fade links you aren't pointing at", "▭"),
		{
			kind: "Effect", icon: "◐", title: "Toggle dark mode", hint: "Light and dark",
			on: () => html.classList.contains("dark"),
			run: () => { html.classList.toggle("dark"); return false; },
		},
		sectionJump(".site-posts", "Jump to writing", "↓"),
		sectionJump(".site-projects", "Jump to projects", "↓"),
		sectionJump(".site-talks", "Jump to speaking", "↓"),
		{ kind: "Jump", icon: "↑", title: "Back to top", hint: "Scroll to the top", run: () => root.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }) },
	];

	let entries = [];
	function buildIndex() {
		entries = [...root.querySelectorAll(".site-item")].map((el) => {
			const cls = Object.keys(KINDS).find((k) => el.classList.contains(k));
			const title = el.querySelector(".site-item-title")?.textContent.trim() ?? "";
			const desc = el.querySelector(".site-item-description")?.textContent.trim() ?? "";
			const meta = el.querySelector(".site-item-meta")?.textContent.trim() ?? "";
			return { kind: KINDS[cls] ?? "Item", icon: { Post: "✎", Project: "◆", Talk: "🎤" }[KINDS[cls]] ?? "•", title, hint: desc || meta, meta, el, run: () => go(el) };
		});
	}

	let shown = [], sel = 0;
	function results(q) {
		q = q.trim();
		if (!q) return [...commands.slice(0, 7).map((e) => ({ e })), ...entries.slice(0, 4).map((e) => ({ e }))];
		const out = [];
		for (const e of [...commands, ...entries]) {
			const t = fuzzy(q, e.title);
			if (t) {
				out.push({ e, score: t.score + 10, idx: t.idx });
				continue;
			}
			const d = fuzzy(q, `${e.hint ?? ""} ${e.meta ?? ""}`);
			if (d) out.push({ e, score: d.score * 0.35 });
		}
		return out.sort((a, b) => b.score - a.score).slice(0, 9);
	}
	function mark(text, idx) {
		const frag = document.createDocumentFragment();
		const set = new Set(idx ?? []);
		let buf = "", hot = false;
		const flush = () => {
			if (!buf) return;
			if (hot) {
				const m = document.createElement("mark");
				m.textContent = buf;
				frag.append(m);
			} else frag.append(buf);
			buf = "";
		};
		[...text].forEach((ch, i) => {
			const h = set.has(i);
			if (h !== hot) flush();
			hot = h;
			buf += ch;
		});
		flush();
		return frag;
	}
	function render() {
		shown = results(input.value);
		sel = Math.min(sel, Math.max(0, shown.length - 1));
		list.textContent = "";
		if (!shown.length) {
			const li = document.createElement("li");
			li.className = "cb-empty";
			li.textContent = `Nothing matches “${input.value}”`;
			list.append(li);
			return;
		}
		shown.forEach(({ e, idx }, i) => {
			const li = document.createElement("li");
			li.setAttribute("role", "option");
			li.id = "cb-opt-" + i;
			li.setAttribute("aria-selected", String(i === sel));
			const ico = Object.assign(document.createElement("span"), { className: "cb-ico", textContent: e.icon });
			const body = document.createElement("span");
			body.className = "cb-body";
			const title = document.createElement("b");
			title.append(mark(e.title, idx));
			const hint = document.createElement("small");
			hint.textContent = e.hint ?? "";
			body.append(title, hint);
			const tag = document.createElement("span");
			tag.className = "cb-tag";
			tag.textContent = e.on ? (e.on() ? "On" : "Off") : e.kind;
			if (e.on?.()) tag.classList.add("is-on");
			li.append(ico, body, tag);
			li.addEventListener("pointermove", () => {
				if (sel !== i) {
					sel = i;
					paintSel();
				}
			});
			li.addEventListener("click", () => choose(i));
			list.append(li);
		});
		paintSel();
	}
	function paintSel() {
		[...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === sel)));
		const cur = list.children[sel];
		cur?.scrollIntoView({ block: "nearest" });
		input.setAttribute("aria-activedescendant", cur?.id ?? "");
	}
	async function choose(i) {
		const e = shown[i]?.e;
		if (!e) return;
		const keepOpen = (await e.run()) === false;
		if (keepOpen) render();
		else dlg.close();
	}

	input.addEventListener("input", () => {
		sel = 0;
		render();
	});
	input.addEventListener("keydown", (e) => {
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(1, shown.length);
			paintSel();
		} else if (e.key === "Enter") {
			e.preventDefault();
			choose(sel);
		}
		e.stopPropagation(); // typed keys must never reach the gallery shortcuts
	});
	dlg.addEventListener("click", (e) => {
		if (e.target === dlg) dlg.close();
	});

	return {
		open() {
			if (dlg.open) return;
			buildIndex();
			input.value = "";
			sel = 0;
			render();
			dlg.showModal();
			input.focus();
		},
		destroy() {
			if (dlg.open) dlg.close();
			dlg.remove();
		},
	};
}
