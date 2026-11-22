// A tiny critically-soft spring integrator that writes only `transform` on per-letter spans.

const STIFFNESS = 150;
const DAMPING = 11;
const STEP = 1 / 120;
const REST_EPSILON = 0.04;

class Letter {
	constructor(element) {
		this.element = element;
		this.pos = [0, 0, 0]; // x, y, rotation (deg)
		this.vel = [0, 0, 0];
		this.target = [0, 0, 0];
		this.delay = 0; // seconds until the spring is released
		this.held = false;
		this.resting = true;
		this.center = null;
		this.written = "";
	}

	throwFrom(spread, delay) {
		this.pos = [(Math.random() - 0.5) * spread * 2, (Math.random() - 0.3) * spread * 1.6, (Math.random() - 0.5) * 50];
		this.vel = [0, 0, 0];
		this.delay = delay;
		this.resting = false;
		this.write();
	}

	step(dt) {
		if (this.held) {
			return;
		}
		if (this.delay > 0) {
			this.delay -= dt;
			return;
		}
		let moving = false;
		for (let i = 0; i < 3; i++) {
			const force = STIFFNESS * (this.target[i] - this.pos[i]) - DAMPING * this.vel[i];
			this.vel[i] += force * dt;
			this.pos[i] += this.vel[i] * dt;
			if (Math.abs(this.vel[i]) > REST_EPSILON || Math.abs(this.target[i] - this.pos[i]) > REST_EPSILON) {
				moving = true;
			}
		}
		if (!moving) {
			this.pos = [...this.target];
			this.vel = [0, 0, 0];
		}
		this.resting = !moving;
	}

	write() {
		const [x, y, r] = this.pos;
		const atRest = x === 0 && y === 0 && r === 0;
		const value = atRest ? "" : `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(2)}deg)`;
		if (value !== this.written) {
			this.written = value;
			this.element.style.transform = value;
		}
	}
}

function split(heading) {
	const text = heading.textContent.trim();
	heading.setAttribute("aria-label", text);
	heading.replaceChildren();
	const letters = [];
	text.split(" ").forEach((word, index, words) => {
		const wordEl = document.createElement("span");
		wordEl.className = "word";
		wordEl.setAttribute("aria-hidden", "true");
		for (const char of word) {
			const el = document.createElement("span");
			el.className = "letter";
			el.setAttribute("aria-hidden", "true");
			el.textContent = char;
			wordEl.append(el);
			letters.push(new Letter(el));
		}
		heading.append(wordEl);
		if (index < words.length - 1) {
			heading.append(" ");
		}
	});
	return letters;
}

export function activate({ root, reducedMotion }) {
	if (reducedMotion) {
		return;
	}

	const title = root.querySelector(".site-title");
	const sectionTitles = [...root.querySelectorAll(".site-section-title")];
	const all = [];
	const hero = title ? split(title) : [];
	const groups = sectionTitles.map((el) => ({ el, letters: split(el) }));
	all.push(...hero, ...groups.flatMap((g) => g.letters));

	hero.forEach((letter, i) => letter.throwFrom(90, 0.15 + i * 0.045));
	for (const group of groups) {
		group.letters.forEach((letter) => {
			letter.throwFrom(40, 0);
			letter.held = true;
		});
	}

	let frame = 0;
	let last = 0;
	let accumulator = 0;
	let running = false;

	function tick(now) {
		if (document.hidden) {
			frame = requestAnimationFrame(tick);
			last = 0;
			return;
		}
		const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
		last = now;
		accumulator += dt;
		while (accumulator >= STEP) {
			accumulator -= STEP;
			for (const letter of all) {
				letter.step(STEP);
			}
		}
		let active = false;
		for (const letter of all) {
			letter.write();
			if (!letter.resting && !letter.held) {
				active = true;
			}
		}
		if (active) {
			frame = requestAnimationFrame(tick);
		} else {
			running = false;
			last = 0;
			for (const letter of all) {
				letter.element.style.willChange = "";
			}
		}
	}

	function wake() {
		if (!running) {
			running = true;
			last = 0;
			for (const letter of all) {
				letter.element.style.willChange = "transform";
			}
			frame = requestAnimationFrame(tick);
		}
	}

	wake();

	// Section titles settle as they scroll into view.
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) {
					continue;
				}
				const group = groups.find((g) => g.el === entry.target);
				group?.letters.forEach((letter, i) => {
					letter.held = false;
					letter.resting = false;
					letter.delay = i * 0.03;
				});
				observer.unobserve(entry.target);
				wake();
			}
		},
		{ root, threshold: 0.6 },
	);
	groups.forEach((g) => observer.observe(g.el));

	// Pointer nudges the headline letters, which ease back.
	const RADIUS = 110;
	let pointer = null;
	function measure() {
		for (const letter of hero) {
			const r = letter.element.getBoundingClientRect();
			letter.center = [r.left + r.width / 2 - letter.pos[0], r.top + r.height / 2 - letter.pos[1]];
		}
	}
	function onMove(event) {
		if (!title) {
			return;
		}
		const box = title.getBoundingClientRect();
		const near = event.clientX > box.left - RADIUS && event.clientX < box.right + RADIUS && event.clientY > box.top - RADIUS && event.clientY < box.bottom + RADIUS;
		if (!near) {
			if (pointer) {
				pointer = null;
				for (const letter of hero) {
					letter.target = [0, 0, 0];
					letter.resting = false;
				}
				wake();
			}
			return;
		}
		if (!pointer) {
			measure();
		}
		pointer = [event.clientX, event.clientY];
		for (const letter of hero) {
			if (!letter.center) {
				continue;
			}
			const dx = letter.center[0] - pointer[0];
			const dy = letter.center[1] - pointer[1];
			const distance = Math.hypot(dx, dy);
			const push = Math.max(0, 1 - distance / RADIUS);
			const norm = distance || 1;
			letter.target = [(dx / norm) * push * 22, (dy / norm) * push * 22, (dx / norm) * push * 14];
			letter.resting = false;
		}
		wake();
	}
	document.addEventListener("pointermove", onMove, { passive: true });

	return () => {
		cancelAnimationFrame(frame);
		observer.disconnect();
		document.removeEventListener("pointermove", onMove);
	};
}
