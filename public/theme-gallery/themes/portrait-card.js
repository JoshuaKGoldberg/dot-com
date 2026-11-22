// 122 — Portrait Card: click (or F) to flip the portrait into a 3D card; drag to spin it with inertia.
export function activate({ root, reducedMotion }) {
	const pic = root.querySelector(".site-portrait");
	if (!pic) return;
	const front = document.createElement("div");
	front.className = "pc-front";
	front.append(...pic.childNodes);
	const back = document.createElement("div");
	back.className = "pc-back";
	back.setAttribute("aria-hidden", "true");
	back.innerHTML =
		'<div class="pc-inner"><div class="pc-kicker">Maintainer card</div><div class="pc-name">Josh Goldberg</div>' +
		'<ul class="pc-stats">' +
		'<li><b>typescript-eslint</b><span>★ 16k</span></li>' +
		'<li><b>Learning TypeScript</b><span>O’Reilly</span></li>' +
		'<li><b>SquiggleConf</b><span>organizer</span></li>' +
		'<li><b>Home base</b><span>Boston</span></li></ul>' +
		'<div class="pc-foot">Level: <i>Open source</i></div></div><div class="pc-foil"></div>';
	const card = document.createElement("div");
	card.className = "pc-card";
	card.tabIndex = 0;
	card.setAttribute("role", "button");
	card.setAttribute("aria-label", "Flip portrait card");
	card.append(front, back);
	pic.append(card);

	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Flip the portrait into a card. Drag it to spin.";
	chip.innerHTML = '<span aria-hidden="true">↻</span><span>Flip portrait</span><kbd>F</kbd>';
	root.append(chip);

	// physics: angle about Y (deg), small pitch about X
	let ry = 0, vy = 0, rx = 0, vx = 0, target = 0, dragging = false, raf = 0, last = 0, acc = 0;
	const K = 130, C = 15, STEP = 1 / 120;
	const flipped = () => Math.round(ry / 180) % 2 !== 0;

	function paint() {
		card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
		card.style.setProperty("--shine", String((((ry % 360) + 360) % 360) / 360));
		const f = flipped();
		card.classList.toggle("is-back", f);
		back.setAttribute("aria-hidden", String(!f));
		chip.setAttribute("aria-pressed", String(f));
	}
	function frame(now) {
		raf = 0;
		acc += Math.min(0.05, (now - last) / 1000);
		last = now;
		while (acc >= STEP) {
			acc -= STEP;
			if (!dragging) {
				vy += (-K * (ry - target) - C * vy) * STEP;
				ry += vy * STEP;
				vx += (-K * rx - C * 0.9 * vx) * STEP;
				rx += vx * STEP;
			}
		}
		paint();
		const resting = !dragging && Math.abs(ry - target) < 0.05 && Math.abs(vy) < 0.5 && Math.abs(rx) < 0.05 && Math.abs(vx) < 0.5;
		if (resting) {
			ry = target;
			rx = 0;
			paint();
		} else schedule();
	}
	function schedule() {
		if (!raf) {
			last = performance.now();
			raf = requestAnimationFrame(frame);
		}
	}
	function flip() {
		card.classList.add("is-armed");
		target = (Math.round(ry / 180) + 1) * 180;
		if (reducedMotion) {
			ry = target;
			vy = 0;
			paint();
		} else schedule();
	}

	let sx = 0, sy = 0, startRy = 0, lastX = 0, lastT = 0, vel = 0, moved = 0;
	card.addEventListener("pointerdown", (e) => {
		if (e.button > 0) return;
		card.setPointerCapture(e.pointerId);
		dragging = true;
		moved = 0;
		sx = lastX = e.clientX;
		sy = e.clientY;
		startRy = ry;
		lastT = performance.now();
		vel = 0;
		vy = 0;
		vx = 0;
		card.classList.add("is-armed", "is-grabbed");
	});
	card.addEventListener("pointermove", (e) => {
		if (!dragging) return;
		const dx = e.clientX - sx;
		moved = Math.max(moved, Math.abs(dx), Math.abs(e.clientY - sy));
		ry = startRy + dx * 0.7;
		rx = Math.max(-22, Math.min(22, (sy - e.clientY) * 0.18));
		const now = performance.now();
		const dt = Math.max(1, now - lastT);
		vel = vel * 0.6 + (((e.clientX - lastX) * 0.7) / dt) * 1000 * 0.4;
		lastX = e.clientX;
		lastT = now;
		paint();
	});
	const release = () => {
		if (!dragging) return;
		dragging = false;
		card.classList.remove("is-grabbed");
		if (moved < 5) {
			ry = startRy;
			flip();
			return;
		}
		const stale = performance.now() - lastT > 90;
		vy = stale ? 0 : Math.max(-2600, Math.min(2600, vel));
		target = Math.round((ry + vy * 0.32) / 180) * 180;
		if (reducedMotion) {
			ry = target;
			vy = 0;
			rx = 0;
			paint();
		} else schedule();
	};
	card.addEventListener("pointerup", release);
	card.addEventListener("pointercancel", release);
	card.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			flip();
		}
	});
	const onKey = (event) => {
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "f" || event.key === "F") {
			event.preventDefault();
			card.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
			flip();
		}
	};
	chip.addEventListener("click", () => {
		card.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
		flip();
	});
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("keydown", onKey);
		cancelAnimationFrame(raf);
	};
}
