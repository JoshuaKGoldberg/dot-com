// "Josh Goldberg" as a hanging chain of letter tiles. Position-based verlet chain (distance
// constraints, 24 iterations) at a fixed 120 Hz, with a damped angular spring per tile so letters
// swing a little behind the chain. Hover blows, scroll jolts, drag grabs, and the right pin can be cut.

const DT = 1 / 120;
const GRAVITY = 2600;
const GAP = 13; // visible chain link between tiles
const TILE_H = 42;
const PIN_Y = 18;
const TEXT = "Josh Goldberg";

export function activate({ root, reducedMotion }) {
	const header = root.querySelector(".site-header");
	const logo = root.querySelector(".site-logo");
	const overlayB = root.querySelector(".overlay-b");
	if (!header || !logo || !overlayB) return undefined;

	const stage = document.createElement("div");
	stage.className = "ch-stage";
	const canvas = document.createElement("canvas");
	canvas.className = "ch-canvas";
	canvas.setAttribute("aria-hidden", "true");
	const ctx = canvas.getContext("2d");
	stage.append(canvas);
	logo.classList.add("ch-logo");
	logo.setAttribute("aria-label", TEXT);
	logo.textContent = "";
	stage.append(logo);
	header.append(stage);

	const css = getComputedStyle(root);
	const metal = css.getPropertyValue("--chMetal").trim().split(/\s+/).join(",") || "74,84,98";
	const metalHi = css.getPropertyValue("--chMetalHi").trim().split(/\s+/).join(",") || "214,222,232";
	const pinColor = css.getPropertyValue("--chPin").trim() || "#8a97a8";

	const letters = [];
	for (const ch of TEXT) {
		const el = document.createElement("span");
		el.className = "ch-letter";
		el.setAttribute("aria-hidden", "true");
		el.textContent = ch === " " ? "" : ch;
		if (ch === " ") el.classList.add("is-gap");
		logo.append(el);
		letters.push(el);
	}

	// ---- geometry ----
	let stageW = 0;
	let dpr = 1;
	let floorY = 600;
	const P = []; // points: 0 = left pin, 1..n = letters, n+1 = right pin
	let rest = []; // rest length between P[i] and P[i+1]
	let widths = [];
	let pinB = { x: 0, y: PIN_Y };
	let pinA = { x: 0, y: PIN_Y };
	let cut = false;
	let scale = 1;

	function measure() {
		stageW = Math.round(stage.clientWidth);
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		floorY = 400;
		canvas.width = Math.round(stageW * dpr);
		canvas.height = Math.round((floorY + 60) * dpr);
		canvas.style.width = `${stageW}px`;
		canvas.style.height = `${floorY + 60}px`;
		// natural widths at scale 1
		scale = 1;
		for (const el of letters) el.style.fontSize = "";
		const natural = letters.map((el) => (el.classList.contains("is-gap") ? 16 : Math.max(26, el.scrollWidth + 14)));
		const total = natural.reduce((a, b) => a + b + GAP, 0) + GAP + 20;
		const maxLength = (stageW - 40) / 0.94;
		scale = Math.min(1, maxLength / total);
		widths = natural.map((w) => w * scale);
		letters.forEach((el, i) => {
			el.style.width = `${widths[i]}px`;
			el.style.height = `${TILE_H * scale}px`;
			el.style.fontSize = `${1.9 * scale}rem`;
		});
	}

	function build() {
		measure();
		const n = letters.length;
		const gap = GAP * scale;
		rest = [];
		const w = [10, ...widths, 10];
		for (let i = 0; i <= n; i++) rest.push((w[i] + w[i + 1]) / 2 + gap);
		const length = rest.reduce((a, b) => a + b, 0);
		const span = length * 0.935;
		pinA = { x: (stageW - span) / 2, y: PIN_Y };
		pinB = { x: (stageW + span) / 2, y: PIN_Y };
		P.length = 0;
		P.push({ x: pinA.x, y: pinA.y, xp: pinA.x, yp: pinA.y, w: 0, ang: 0, angv: 0 });
		for (let i = 0; i < n; i++) {
			const t = (i + 1) / (n + 1);
			const x = pinA.x + (pinB.x - pinA.x) * t;
			const y = PIN_Y + (Math.random() - 0.5) * 6 + 2;
			P.push({ x, y, xp: x, yp: y, w: 1, ang: 0, angv: 0 });
		}
		P.push({ x: pinB.x, y: pinB.y, xp: pinB.x, yp: pinB.y, w: 0, ang: 0, angv: 0 });
		cut = false;
		bCut.setAttribute("aria-pressed", "false");
		bCut.textContent = "Cut the chain";
	}

	// ---- simulation ----
	let grab = null;

	function step() {
		const n = letters.length;
		for (let i = 1; i <= n + 1; i++) {
			const p = P[i];
			if (p.w === 0) continue;
			const vx = (p.x - p.xp) * 0.9965;
			const vy = (p.y - p.yp) * 0.9965;
			p.xp = p.x;
			p.yp = p.y;
			p.x += vx;
			p.y += vy + GRAVITY * DT * DT;
		}
		if (grab) {
			const p = P[grab.i];
			p.xp = p.x;
			p.yp = p.y;
			p.x += (grab.x - p.x) * 0.6;
			p.y += (grab.y - p.y) * 0.6;
		}
		for (let iter = 0; iter < 24; iter++) {
			for (let i = 0; i <= n; i++) {
				const a = P[i];
				const b = P[i + 1];
				const wa = grab && grab.i === i ? 0 : a.w;
				const wb = grab && grab.i === i + 1 ? 0 : b.w;
				const ws = wa + wb;
				if (ws === 0) continue;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const d = Math.hypot(dx, dy) || 0.0001;
				const diff = (d - rest[i]) / d;
				a.x += (dx * diff * wa) / ws;
				a.y += (dy * diff * wa) / ws;
				b.x -= (dx * diff * wb) / ws;
				b.y -= (dy * diff * wb) / ws;
			}
		}
		// floor + side walls matter after the chain is cut
		for (let i = 1; i <= n + 1; i++) {
			const p = P[i];
			if (p.w === 0) continue;
			if (p.y > floorY) {
				p.y = floorY;
				p.xp = p.x - (p.x - p.xp) * 0.6;
				p.yp = p.y + (p.y - p.yp) * 0.2;
			}
			if (p.x < 6) p.x = 6;
			else if (p.x > stageW - 6) p.x = stageW - 6;
		}
		// letter tilt: damped spring toward the local tangent
		let energy = 0;
		for (let i = 1; i <= n; i++) {
			const p = P[i];
			const a = P[i - 1];
			const b = P[i + 1];
			let target = Math.atan2(b.y - a.y, b.x - a.x);
			if (cut && i === n) target = Math.atan2(p.y - a.y, p.x - a.x);
			target = Math.max(-1.25, Math.min(1.25, target));
			p.angv += (240 * (target - p.ang) - 7.5 * p.angv) * DT;
			p.ang += p.angv * DT;
			energy += (p.x - p.xp) ** 2 + (p.y - p.yp) ** 2 + p.angv * p.angv * 0.01;
		}
		return energy / n;
	}

	// ---- drawing ----
	function link(x, y, angle, long, thick, edgeOn) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);
		if (edgeOn) {
			ctx.lineWidth = thick + 1.2;
			ctx.strokeStyle = `rgba(${metal},1)`;
			ctx.beginPath();
			ctx.moveTo(-long / 2 + 3, 0);
			ctx.lineTo(long / 2 - 3, 0);
			ctx.stroke();
			ctx.lineWidth = 1;
			ctx.strokeStyle = `rgba(${metalHi},0.8)`;
			ctx.beginPath();
			ctx.moveTo(-long / 2 + 4, -0.8);
			ctx.lineTo(long / 2 - 4, -0.8);
			ctx.stroke();
		} else {
			const h = thick * 1.7;
			ctx.lineWidth = thick;
			ctx.strokeStyle = `rgba(${metal},1)`;
			ctx.beginPath();
			ctx.roundRect(-long / 2, -h / 2, long, h, h / 2);
			ctx.stroke();
			ctx.lineWidth = 1;
			ctx.strokeStyle = `rgba(${metalHi},0.75)`;
			ctx.beginPath();
			ctx.roundRect(-long / 2 + 1.2, -h / 2 + 1.2, long - 2.4, h - 2.4, h / 2);
			ctx.stroke();
		}
		ctx.restore();
	}

	function draw() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, stageW, floorY + 60);
		const n = letters.length;
		// links between consecutive points, hidden behind the tiles at either end
		for (let i = 0; i <= n; i++) {
			const a = P[i];
			const b = P[i + 1];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const d = Math.hypot(dx, dy) || 1;
			const angle = Math.atan2(dy, dx);
			const wa = i === 0 ? 4 : widths[i - 1] / 2;
			const wb = i === n ? 4 : widths[i] / 2;
			// link spans from the edge of tile a to the edge of tile b, overlapping each eyelet
			const edgeA = Math.max(0, Math.min(wa, d * 0.45)) - 4;
			const edgeB = Math.max(0, Math.min(wb, d * 0.45)) - 4;
			const len = Math.max(10, d - edgeA - edgeB + 8);
			const mx = a.x + (dx / d) * (edgeA + len / 2 - 4);
			const my = a.y + (dy / d) * (edgeA + len / 2 - 4);
			link(mx, my, angle, len, 2.6, i % 2 === 1);
			// the space is a bigger double link
			if ((i >= 1 && letters[i - 1]?.classList.contains("is-gap")) || letters[i]?.classList.contains("is-gap")) {
				link(mx, my, angle + 0.0, len + 6, 2.8, false);
			}
		}
		// pins
		for (const pin of cut ? [pinA] : [pinA, pinB]) {
			ctx.fillStyle = pinColor;
			ctx.beginPath();
			ctx.arc(pin.x, pin.y, 7, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = `rgba(${metalHi},0.6)`;
			ctx.lineWidth = 1.2;
			ctx.stroke();
			ctx.strokeStyle = "rgba(0,0,0,0.45)";
			ctx.beginPath();
			ctx.moveTo(pin.x - 3.5, pin.y - 3.5);
			ctx.lineTo(pin.x + 3.5, pin.y + 3.5);
			ctx.stroke();
		}
		// tiles
		for (let i = 1; i <= n; i++) {
			const p = P[i];
			const el = letters[i - 1];
			const w = widths[i - 1];
			const value = `translate3d(${(p.x - w / 2).toFixed(2)}px, ${(p.y - (TILE_H * scale) / 2).toFixed(2)}px, 0) rotate(${p.ang.toFixed(4)}rad)`;
			if (el._v !== value) {
				el._v = value;
				el.style.transform = value;
			}
		}
	}

	// ---- loop ----
	let raf = 0;
	let running = false;
	let last = 0;
	let acc = 0;
	let calm = 0;
	let visible = true;

	function frame(now) {
		raf = 0;
		if (!running) return;
		acc += Math.min(0.05, (now - last) / 1000);
		last = now;
		let e = 0;
		let steps = 0;
		while (acc >= DT && steps < 5) {
			e = step();
			acc -= DT;
			steps++;
		}
		draw();
		calm = e < 0.0004 && !grab ? calm + 1 : 0;
		if (calm > 30) {
			running = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function wake() {
		calm = 0;
		if (running || document.hidden || !visible) return;
		running = true;
		last = performance.now();
		acc = 0;
		raf = requestAnimationFrame(frame);
	}

	function stop() {
		running = false;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function settleNow(steps = 900) {
		for (let i = 0; i < steps; i++) step();
		draw();
	}

	// ---- controls ----
	const controls = document.createElement("div");
	controls.className = "ch-controls";
	const hint = document.createElement("span");
	hint.className = "ch-hint";
	hint.textContent = "Drag a letter · wave over the chain · scroll to jolt it";
	const bCut = document.createElement("button");
	bCut.type = "button";
	bCut.className = "ch-btn";
	bCut.setAttribute("aria-pressed", "false");
	bCut.textContent = "Cut the chain";
	const bReset = document.createElement("button");
	bReset.type = "button";
	bReset.className = "ch-btn";
	bReset.textContent = "Re-hang";
	controls.append(hint, bCut, bReset);
	overlayB.append(controls);
	const hintTimer = setTimeout(() => hint.classList.add("is-gone"), 10000);

	bCut.addEventListener("click", () => {
		cut = !cut;
		bCut.setAttribute("aria-pressed", String(cut));
		bCut.textContent = cut ? "Re-pin" : "Cut the chain";
		const end = P[letters.length + 1];
		if (cut) {
			end.w = 1;
			end.xp = end.x;
			end.yp = end.y - 1;
		} else {
			// snap the free end back to its pin; the chain will swing back
			end.w = 0;
			end.x = end.xp = pinB.x;
			end.y = end.yp = pinB.y;
		}
		wake();
	});
	bReset.addEventListener("click", () => {
		build();
		if (reducedMotion) settleNow();
		wake();
	});

	// ---- input ----
	let swallowClick = false;
	let rect = stage.getBoundingClientRect();
	let lastPX = null;
	let lastPY = null;

	function toStage(event) {
		return [event.clientX - rect.left, event.clientY - rect.top];
	}

	function onMove(event) {
		rect = stage.getBoundingClientRect();
		const [x, y] = toStage(event);
		if (grab) {
			grab.x = x;
			grab.y = y;
			if (Math.hypot(event.clientX - grab.cx, event.clientY - grab.cy) > 4) grab.moved = true;
			wake();
		} else if (y > -70 && y < 330 && x > -40 && x < stageW + 40 && lastPX !== null) {
			const dx = x - lastPX;
			const dy = y - lastPY;
			if (Math.abs(dx) + Math.abs(dy) > 0.5) {
				let touched = false;
				for (let i = 1; i <= letters.length + 1; i++) {
					const p = P[i];
					if (p.w === 0) continue;
					const d = Math.hypot(p.x - x, p.y - y);
					if (d > 70) continue;
					const f = (1 - d / 70) ** 1.5 * 0.55;
					p.xp -= dx * f;
					p.yp -= dy * f;
					touched = true;
				}
				if (touched) wake();
			}
		}
		lastPX = x;
		lastPY = y;
	}

	function onDown(event) {
		if (event.button !== 0) return;
		const el = event.target.closest?.(".ch-letter");
		if (!el || el.classList.contains("is-gap")) return;
		const i = letters.indexOf(el) + 1;
		if (i < 1) return;
		rect = stage.getBoundingClientRect();
		const [x, y] = toStage(event);
		grab = { i, x, y, cx: event.clientX, cy: event.clientY, moved: false };
		el.classList.add("is-grabbed");
		hint.classList.add("is-gone");
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		event.preventDefault();
		wake();
	}

	function onUp() {
		if (!grab) return;
		letters[grab.i - 1].classList.remove("is-grabbed");
		if (grab.moved) {
			swallowClick = true;
			setTimeout(() => (swallowClick = false), 0);
		}
		grab = null;
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		wake();
	}

	function onClickCapture(event) {
		if (swallowClick) {
			event.preventDefault();
			event.stopPropagation();
			swallowClick = false;
		}
	}

	let lastScroll = root.scrollTop;
	function onScroll() {
		const d = root.scrollTop - lastScroll;
		lastScroll = root.scrollTop;
		if (Math.abs(d) < 1) return;
		const k = Math.max(-70, Math.min(70, d)) * 0.5;
		for (let i = 1; i <= letters.length + 1; i++) {
			const p = P[i];
			if (p.w === 0) continue;
			// the page moved; the dangling chain lags behind it
			p.yp -= k * (reducedMotion ? 0.4 : 1);
		}
		wake();
	}

	function onVisibility() {
		if (document.hidden) stop();
		else wake();
	}

	// ---- boot ----
	function boot() {
		build();
		if (reducedMotion) {
			settleNow();
		} else {
			wake();
		}
	}

	const fontsReady = document.fonts?.ready ?? Promise.resolve();
	let disposed = false;
	boot();
	fontsReady.then(() => {
		if (disposed) return;
		boot();
	});

	let resizeTimer = 0;
	const resizeObserver = new ResizeObserver(() => {
		if (Math.round(stage.clientWidth) === stageW) return;
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			boot();
		}, 120);
	});
	resizeObserver.observe(stage);

	const intersection = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (visible) wake();
		else stop();
	});
	intersection.observe(stage);

	window.addEventListener("pointermove", onMove, { passive: true });
	stage.addEventListener("pointerdown", onDown);
	stage.addEventListener("click", onClickCapture, true);
	root.addEventListener("scroll", onScroll, { passive: true });
	document.addEventListener("visibilitychange", onVisibility);

	return () => {
		disposed = true;
		stop();
		clearTimeout(hintTimer);
		clearTimeout(resizeTimer);
		resizeObserver.disconnect();
		intersection.disconnect();
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		root.removeEventListener("scroll", onScroll);
		document.removeEventListener("visibilitychange", onVisibility);
	};
}
