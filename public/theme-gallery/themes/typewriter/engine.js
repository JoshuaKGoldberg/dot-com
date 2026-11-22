const FONT_URL = "https://fonts.googleapis.com/css2?family=Special+Elite&display=swap";

export function create(root, reduced, onDone) {
	const page = root.querySelector(".site-page");
	let link;
	let pairs = [];
	let caret;
	let raf = 0;
	let run = 0;
	let ctx;
	let noise;
	let sound = false;
	const api = { typing: false };

	const wait = (ms) => new Promise((r) => setTimeout(r, ms));

	// Sound is synthesized on demand: nothing exists until the user turns it on.
	function ensureAudio() {
		if (ctx) return;
		ctx = new AudioContext();
		noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
		const d = noise.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
	}
	let lastClack = 0;
	function clack(heavy) {
		if (!sound || !ctx) return;
		const t = ctx.currentTime;
		if (t - lastClack < 0.035) return;
		lastClack = t;
		const src = ctx.createBufferSource();
		src.buffer = noise;
		src.playbackRate.value = heavy ? 0.7 : 0.9 + Math.random() * 0.4;
		const bp = ctx.createBiquadFilter();
		bp.type = "bandpass";
		bp.frequency.value = heavy ? 900 : 1700 + Math.random() * 900;
		bp.Q.value = 0.9;
		const g = ctx.createGain();
		g.gain.value = heavy ? 0.5 : 0.28;
		src.connect(bp).connect(g).connect(ctx.destination);
		src.start(t);
	}
	function bell() {
		if (!sound || !ctx) return;
		const t = ctx.currentTime;
		for (const [f, a] of [[2349, 0.12], [3520, 0.06]]) {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.frequency.value = f;
			g.gain.setValueAtTime(a, t);
			g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
			o.connect(g).connect(ctx.destination);
			o.start(t);
			o.stop(t + 1.2);
		}
	}

	function textNodes() {
		const out = [];
		const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
			acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
		});
		while (w.nextNode()) out.push(w.currentNode);
		return out;
	}

	async function loadFont() {
		if (!link) {
			link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = FONT_URL;
			document.head.append(link);
		}
		await Promise.race([document.fonts.load('16px "Special Elite"'), wait(1500)]).catch(() => {});
	}

	function split() {
		pairs = textNodes().map((node) => {
			const full = node.nodeValue;
			const typed = document.createElement("span");
			const rest = document.createElement("span");
			typed.className = "tw-typed";
			rest.className = "tw-rest";
			rest.textContent = full;
			node.replaceWith(typed, rest);
			return { node, typed, rest, full, i: 0 };
		});
	}

	function finishPair(p) {
		p.typed.textContent = p.full;
		p.rest.textContent = "";
		p.i = p.full.length;
	}

	function caretAt(p) {
		const r = document.createRange();
		if (p.i > 0) {
			r.selectNodeContents(p.typed);
			const rects = r.getClientRects();
			const last = rects[rects.length - 1];
			if (last) return { x: last.right, y: last.top, h: last.height };
		}
		const first = p.rest.getClientRects()[0];
		return first ? { x: first.left, y: first.top, h: first.height } : undefined;
	}

	function placeCaret(c, jump) {
		if (!c) return;
		caret.style.height = `${c.h}px`;
		caret.style.width = `${Math.max(7, c.h * 0.5)}px`;
		caret.classList.toggle("is-jump", !!jump);
		caret.style.transform = `translate(${c.x}px, ${c.y}px)`;
	}

	async function start() {
		const my = ++run;
		await loadFont();
		if (my !== run) return;
		root.classList.add("tw-on");
		if (reduced) return;
		root.classList.add("tw-typing");
		if (sound) { ensureAudio(); ctx.resume?.(); }
		split();
		caret = document.createElement("div");
		caret.className = "tw-caret";
		root.append(caret);
		api.typing = true;

		const vh = innerHeight;
		const visible = pairs.filter((p) => {
			const r = p.rest.getBoundingClientRect();
			return r.bottom > 0 && r.top < vh;
		});
		const hidden = pairs.filter((p) => !visible.includes(p));

		// The viewport is typed by hand, with a carriage return at each wrap; the rest is typed in a flash.
		let queue = [...visible];
		let cur;
		let last = 0;
		let budget = 0;
		let pause = 0;
		let lastY = null;
		let fast = false;
		let active;

		const tick = (now) => {
			raf = 0;
			if (my !== run) return;
			const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
			last = now;
			if (pause > 0) { pause -= dt; }
			else {
				budget += dt * (fast ? 900 : 95 + Math.random() * 50);
				let typedAny = false;
				while (budget >= 1 && (cur || queue.length)) {
					cur ??= queue.shift();
					if (!cur) break;
					active = cur;
					const ch = cur.full[cur.i];
					cur.i++;
					budget -= ch === " " ? 0.6 : 1;
					typedAny = true;
					if (cur.i >= cur.full.length) { finishPair(cur); cur = null; if (!fast) { pause = 0.12; break; } }
					else if (!fast && /[.,;:]/.test(ch)) { pause = 0.09; break; }
				}
				if (cur && typedAny) {
					cur.typed.textContent = cur.full.slice(0, cur.i);
					cur.rest.textContent = cur.full.slice(cur.i);
				}
				if (!fast) {
					if (typedAny) {
						clack(false);
						const target = active;
						const c = target && caretAt(target);
						if (c) {
							const wrapped = lastY !== null && c.y - lastY > c.h * 0.6;
							if (wrapped) { pause = Math.max(pause, 0.22); bell(); clack(true); }
							placeCaret(c, wrapped);
							caret.classList.remove("is-idle");
							lastY = c.y;
						}
					}
				}
				if (!cur && !queue.length) {
					if (!fast && hidden.length) { fast = true; queue = [...hidden]; caret.style.opacity = "0"; }
					else return done();
				}
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		api.skip = () => {
			for (const p of pairs) finishPair(p);
			cancelAnimationFrame(raf);
			raf = 0;
			done();
		};
		function done() {
			api.typing = false;
			root.classList.remove("tw-typing");
			if (caret) {
				caret.style.opacity = "";
				const lp = pairs.at(-1);
				lp && placeCaret(caretAt(lp), false);
				// Park the caret after the last visible word, blinking.
				const target = visible.at(-1) ?? lp;
				const c = target && caretAt(target);
				if (c) placeCaret(c, false);
				caret.classList.add("is-idle");
			}
		}
	}

	function restore() {
		cancelAnimationFrame(raf);
		raf = 0;
		for (const p of pairs) {
			p.typed.replaceWith(p.node);
			p.rest.remove();
		}
		pairs = [];
		caret?.remove();
		caret = undefined;
		api.typing = false;
	}

	api.skip = () => {};
	api.start = start;
	api.stop = () => {
		run++;
		restore();
		root.classList.remove("tw-on", "tw-typing");
	};
	api.setSound = (on) => {
		sound = on;
		if (on) { ensureAudio(); ctx.resume?.(); clack(true); }
	};
	api.destroy = () => {
		run++;
		cancelAnimationFrame(raf);
		link?.remove();
		ctx?.close?.();
		void onDone;
	};
	return api;
}
