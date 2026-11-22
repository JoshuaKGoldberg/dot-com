// Opt-in play shell shared by the forest platformers. Until the visitor presses "Play" (or Enter)
// the only cost is one button and one window keydown listener. While playing: a pixel canvas in the
// overlay (pointer-events: none), claimed keys, optional touch buttons, and a fixed-step loop that
// pauses when the tab is hidden. The page keeps scrolling and links keep working.

const STEP = 1 / 120;
const CLAIM = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Space"]);

const typing = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function readColors(root, names) {
	const cs = getComputedStyle(root);
	const out = {};
	for (const n of names) out[n] = cs.getPropertyValue(`--${n}`).trim();
	return out;
}

export function docRect(root, node) {
	const rr = root.getBoundingClientRect();
	const r = node.getBoundingClientRect();
	return { x: r.left - rr.left + root.scrollLeft, y: r.top - rr.top + root.scrollTop, w: r.width, h: r.height };
}

// Real line boxes of every text node under `scope`, via Range.getClientRects(), merged per visual line.
export function textLineRects(root, scope, filter) {
	const rr = root.getBoundingClientRect();
	const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	const raw = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (!n.nodeValue.trim()) continue;
		const parent = n.parentElement;
		if (!parent || parent.closest("button, script, style") || (filter && !filter(parent))) continue;
		range.selectNodeContents(n);
		for (const q of range.getClientRects()) {
			if (q.width < 4 || q.height < 6) continue;
			raw.push({ x: q.left - rr.left + root.scrollLeft, y: q.top - rr.top + root.scrollTop, w: q.width, h: q.height, el: parent });
		}
	}
	raw.sort((a, b) => a.y - b.y || a.x - b.x);
	const lines = [];
	for (const q of raw) {
		const last = lines[lines.length - 1];
		if (last && Math.abs(q.y + q.h / 2 - (last.y + last.h / 2)) < Math.min(q.h, last.h) * 0.4 && q.x <= last.x + last.w + 10 && q.x >= last.x - 2) {
			const right = Math.max(last.x + last.w, q.x + q.w);
			last.w = right - last.x;
			last.y = Math.min(last.y, q.y);
			last.h = Math.max(last.h, q.h);
		} else lines.push({ ...q });
	}
	return lines;
}

export function createCam(root, reduced) {
	let lastUser = 0, lastSet = -1;
	const mark = () => {
		lastUser = performance.now();
	};
	const onScroll = () => {
		if (Math.abs(root.scrollTop - lastSet) > 1.5) mark();
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	root.addEventListener("wheel", mark, { passive: true });
	root.addEventListener("touchmove", mark, { passive: true });
	return {
		// Keep `y` (doc coords) inside a comfortable band; ease unless reduced motion.
		follow(y, viewH, dt, band = 0.2, bias = 0.5) {
			if (performance.now() - lastUser < 1400) return;
			const top = root.scrollTop;
			const center = top + viewH * bias;
			const off = y - center;
			if (Math.abs(off) < viewH * band) return;
			const goal = y - viewH * bias;
			const next = reduced ? top + Math.sign(off) * (Math.abs(off) - viewH * band) : top + (goal - top) * Math.min(1, dt * 4.5);
			root.scrollTop = next;
			lastSet = root.scrollTop;
		},
		scrollTo(y) {
			root.scrollTop = y;
			lastSet = root.scrollTop;
		},
		userActive: () => performance.now() - lastUser < 1400,
		destroy() {
			root.removeEventListener("scroll", onScroll);
			root.removeEventListener("wheel", mark);
			root.removeEventListener("touchmove", mark);
		},
	};
}

export function createPlayShell(o) {
	const { root, reducedMotion, label = "Play", hint = "Arrows / A D move · Space jumps · Esc exits", touch, start, onExit } = o;
	const overlayA = root.querySelector(".overlay-a");
	const overlayB = root.querySelector(".overlay-b");
	const input = { left: false, right: false, up: false, down: false, space: false, jump: false, jumpCount: 0 };
	const keyState = new Set();
	let playing = false, raf = 0, game = null, canvas = null, ctx = null, last = 0, acc = 0, ro = null;
	const sh = { root, input, reduced: reducedMotion, w: 0, h: 0, ctx: null, canvas: null };

	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "play-btn";
	btn.setAttribute("aria-label", `${label}: opt-in game. Press Enter to start, Escape to stop.`);
	const setBtn = () => {
		btn.innerHTML = playing ? `<span aria-hidden="true">■</span> Exit <kbd>Esc</kbd>` : `<span aria-hidden="true">▶</span> ${label} <kbd>Enter</kbd>`;
	};
	setBtn();
	const hud = document.createElement("div");
	hud.className = "play-hud";
	hud.setAttribute("aria-live", "off");
	const toastEl = document.createElement("div");
	toastEl.className = "play-toast";
	toastEl.setAttribute("role", "status");
	overlayB.append(btn, hud, toastEl);

	let touchEl = null;
	if (touch) {
		touchEl = document.createElement("div");
		touchEl.className = "play-touch";
		const groups = { l: document.createElement("div"), r: document.createElement("div") };
		for (const g of Object.values(groups)) {
			g.className = "play-touch-group";
			touchEl.appendChild(g);
		}
		for (const t of touch) {
			const b = document.createElement("button");
			b.type = "button";
			b.textContent = t.text;
			b.setAttribute("aria-label", t.aria || t.key);
			b.tabIndex = -1;
			const set = (v) => {
				if (input[t.key] === v) return;
				input[t.key] = v;
				b.classList.toggle("down", v);
				if (t.key === "up" || t.key === "space" || t.key === "jump") {
					input.jump = v;
					if (v) input.jumpCount++;
				}
			};
			b.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				b.setPointerCapture(e.pointerId);
				set(true);
			});
			for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, () => set(false));
			groups[t.side || "l"].appendChild(b);
		}
		overlayB.appendChild(touchEl);
	}
	if (matchMedia("(pointer: coarse)").matches || new URLSearchParams(location.search).has("touch")) root.classList.add("has-touch");
	const onTouchStart = () => root.classList.add("has-touch");
	window.addEventListener("touchstart", onTouchStart, { once: true, passive: true });

	function setKey(code, down) {
		if (down) keyState.add(code);
		else keyState.delete(code);
		input.left = keyState.has("ArrowLeft") || keyState.has("KeyA");
		input.right = keyState.has("ArrowRight") || keyState.has("KeyD");
		input.up = keyState.has("ArrowUp") || keyState.has("KeyW");
		input.down = keyState.has("ArrowDown") || keyState.has("KeyS");
		input.space = keyState.has("Space");
		input.jump = input.up || input.space;
		if (down && (code === "ArrowUp" || code === "KeyW" || code === "Space")) input.jumpCount++;
	}

	function resize() {
		if (!canvas) return;
		const w = overlayA.clientWidth, h = overlayA.clientHeight;
		sh.w = w;
		sh.h = h;
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
			ctx.imageSmoothingEnabled = false;
		}
		game?.resize?.(w, h);
	}

	function frame(now) {
		raf = requestAnimationFrame(frame);
		if (!last) last = now;
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		acc += dt;
		let n = 0;
		while (acc >= STEP && n < 10) {
			game.step(STEP, input);
			acc -= STEP;
			n++;
		}
		if (n === 10) acc = 0;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		game.draw(ctx, dt);
		const t = game.hud?.();
		if (t != null && t !== hud._t) {
			hud._t = t;
			hud.textContent = `${t}${t ? "\n" : ""}${hint}`;
		}
	}

	function run() {
		cancelAnimationFrame(raf);
		last = 0;
		acc = 0;
		raf = requestAnimationFrame(frame);
	}

	const onVis = () => {
		if (!playing) return;
		if (document.hidden) cancelAnimationFrame(raf);
		else run();
	};

	function enter() {
		if (playing) return;
		playing = true;
		root.classList.add("is-playing");
		canvas = document.createElement("canvas");
		canvas.className = "play-canvas";
		canvas.setAttribute("aria-hidden", "true");
		overlayA.appendChild(canvas);
		ctx = canvas.getContext("2d");
		sh.canvas = canvas;
		sh.ctx = ctx;
		resize();
		game = start(sh);
		resize();
		ro = new ResizeObserver(() => resize());
		ro.observe(overlayA);
		document.addEventListener("visibilitychange", onVis);
		setBtn();
		btn.blur();
		hud._t = null;
		run();
	}

	function exit() {
		if (!playing) return;
		playing = false;
		cancelAnimationFrame(raf);
		ro?.disconnect();
		document.removeEventListener("visibilitychange", onVis);
		game?.destroy?.();
		game = null;
		canvas?.remove();
		canvas = ctx = null;
		keyState.clear();
		for (const k of ["left", "right", "up", "down", "space", "jump"]) input[k] = false;
		root.classList.remove("is-playing");
		hud.textContent = "";
		setBtn();
		onExit?.();
	}

	btn.addEventListener("click", () => (playing ? exit() : enter()));

	const onKeyDown = (e) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (!playing) {
			if (e.key === "Enter" && !e.repeat && !typing(e.target)) {
				const t = e.target;
				if (t instanceof HTMLElement && t !== document.body && t.closest("a, button, summary, [role=button]")) return;
				if (document.getElementById("gallery-palette")?.hidden === false) return;
				e.preventDefault();
				enter();
			}
			return;
		}
		if (typing(e.target)) return;
		if (e.code === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			exit();
			return;
		}
		if (CLAIM.has(e.code)) {
			e.preventDefault();
			e.stopPropagation();
			if (!e.repeat) setKey(e.code, true);
		}
	};
	const onKeyUp = (e) => {
		if (!playing) return;
		if (CLAIM.has(e.code)) {
			e.preventDefault();
			e.stopPropagation();
			setKey(e.code, false);
		}
	};
	const onBlur = () => {
		keyState.clear();
		for (const k of ["left", "right", "up", "down", "space", "jump"]) input[k] = false;
	};
	window.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("keyup", onKeyUp, true);
	window.addEventListener("blur", onBlur);

	let toastTimer = 0;
	sh.toast = (text, ms = 2200) => {
		toastEl.textContent = text;
		toastEl.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
	};
	sh.exit = exit;
	sh.isPlaying = () => playing;
	sh.enter = enter;
	sh.destroy = () => {
		exit();
		clearTimeout(toastTimer);
		window.removeEventListener("keydown", onKeyDown, true);
		window.removeEventListener("keyup", onKeyUp, true);
		window.removeEventListener("blur", onBlur);
		window.removeEventListener("touchstart", onTouchStart);
		btn.remove();
		hud.remove();
		toastEl.remove();
		touchEl?.remove();
	};
	return sh;
}

export const PLATFORMER_TOUCH = [
	{ key: "left", text: "◀", aria: "Move left", side: "l" },
	{ key: "right", text: "▶", aria: "Move right", side: "l" },
	{ key: "down", text: "▼", aria: "Drop down", side: "r" },
	{ key: "jump", text: "▲", aria: "Jump", side: "r" },
];
