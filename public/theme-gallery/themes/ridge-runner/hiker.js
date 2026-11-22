// The little hiker: an original character (red knit hat with a pom, teal scarf, mustard jacket,
// big green pack with a blue bedroll) drawn as procedural pixel art, plus the shared platformer
// controller used by #99, #100 and #103.
//
// Feel: coyote time, jump buffering, variable jump height (gravity cut on release), apex hang,
// asymmetric fall gravity, ground/air acceleration, skid turns, drop-through one-way platforms.
// World units are CSS px. `P` is how many CSS px one sprite pixel covers.

const C = {
	hat: "#d8402c", hatD: "#a62c22", hatL: "#f26d4f", cuff: "#f3e5c4", cuffD: "#d5bf92", pom: "#fff7e6", pomD: "#e7d8b8",
	skin: "#f4c9a1", skinD: "#dba278", hair: "#6a3f26", eye: "#241a18", blush: "#ec9482", mouth: "#a8503e",
	scarf: "#2f9a93", scarfD: "#217670", jacket: "#e6a82f", jacketD: "#b97c1b", jacketL: "#f4c75e",
	belt: "#5a3a24", pants: "#36523f", pantsD: "#26402f", boot: "#7a4e2c", bootD: "#4b2f1b", sole: "#2c1d12",
	pack: "#4f7f59", packD: "#385e43", flap: "#d6742c", flapD: "#a85620", roll: "#86b8cc", rollD: "#5c91aa", strap: "#243628",
};
export const HIKER_COLORS = C;

const R = (ctx, ox, oy, P, face, x, y, w, h, color) => {
	ctx.fillStyle = color;
	const xx = face > 0 ? x : 12 - x - w;
	ctx.fillRect(ox + xx * P, oy + y * P, w * P, h * P);
};

// Draw the hiker. ox/oy: top-left of the 12x16 sprite box in canvas px (integers).
// a: { pose, phase, b (extra body drop), blink, pomX, pomY, armF:[x,y], armB:[x,y], legs:[[dx,dy],[dx,dy]], lean, short }
export function drawHiker(ctx, ox, oy, P, face, a) {
	const r = (x, y, w, h, c) => R(ctx, ox, oy, P, face, x, y, w, h, c);
	const b = a.b || 0;
	const lean = a.lean || 0;
	const seated = a.pose === "sit" || a.pose === "sled" || a.pose === "duck";

	// --- back arm (behind torso)
	const arm = (sx, sy, hx, hy, col, hand) => {
		const steps = 3;
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const px = Math.round(sx + (hx - sx) * t), py = Math.round(sy + (hy - sy) * t);
			r(px, py, 2, 2, col);
		}
		r(Math.round(hx), Math.round(hy) + 1, 2, 1, hand);
	};
	if (a.armB) arm(5 + lean, 9 + b, a.armB[0], a.armB[1] + b, C.jacketD, C.skinD);

	// --- legs
	if (!seated) {
		const legs = a.legs || [[0, 0], [0, 0]];
		const leg = (lx, dx, dy, col, bootc) => {
			if (a.short) {
				r(lx + dx, 15, 3, 1, bootc);
				return;
			}
			r(lx, 13, 2, 1, col);
			if (dy < 0 || dx !== 0) r(lx + (dx > 0 ? 1 : dx < 0 ? -1 : 0) * (dy < 0 ? 1 : 0), 13 + (dy < -1 ? 1 : 0), 2, 1, col);
			r(lx + dx, 14 + dy, 3, 1, bootc);
			r(lx + dx, 15 + dy, 3, 1, C.sole);
		};
		leg(4 + lean, legs[1][0], legs[1][1], C.pantsD, C.bootD);
		leg(6 + lean, legs[0][0], legs[0][1], C.pants, C.boot);
	} else {
		const bb = a.pose === "duck" ? 3 : 0;
		if (a.pose === "sled" || a.pose === "duck") {
			r(8 + lean, 12 + b + bb, 4, 2, C.pants);
			r(11 + lean, 12 + b + bb, 2, 3, C.boot);
			r(11 + lean, 14 + b + bb, 2, 1, C.sole);
			r(5 + lean, 12 + b + bb, 4, 2, C.pantsD);
		}
	}

	// --- pack (lags behind the body when jumping)
	const pk = a.packY || 0;
	r(0 + lean, 4 + b + pk, 4, 2, C.roll);
	r(0 + lean, 4 + b + pk, 4, 1, C.rollD);
	r(0 + lean, 6 + b + pk, 4, 6, C.pack);
	r(0 + lean, 6 + b + pk, 4, 2, C.flap);
	r(0 + lean, 7 + b + pk, 4, 1, C.flapD);
	r(0 + lean, 11 + b + pk, 4, 1, C.packD);
	r(0 + lean, 6 + b + pk, 1, 6, C.packD);

	// --- torso
	r(4 + lean, 8 + b, 6, 4, C.jacket);
	r(4 + lean, 11 + b, 6, 1, C.jacketD);
	r(5 + lean, 8 + b, 2, 1, C.jacketL);
	r(4 + lean, 8 + b, 1, 4, C.jacketD);
	r(4 + lean, 12 + b, 6, 1, C.belt);
	r(7 + lean, 12 + b, 1, 1, "#d8b45a");
	r(4 + lean, 7 + b, 6, 1, C.scarf);
	r(4 + lean, 8 + b, 1, 1, C.strap);
	r(5 + lean, 9 + b, 1, 3, C.strap);
	// scarf tail
	const st = a.scarfY ?? 0;
	r(3 + lean + (a.scarfX || 0), 7 + b + st, 1, 2, C.scarfD);
	if (a.scarfX) r(2 + lean + a.scarfX, 8 + b + st, 1, 1, C.scarfD);

	// --- head
	r(4 + lean, 4 + b, 6, 3, C.skin);
	r(4 + lean, 4 + b, 1, 2, C.hair);
	r(5 + lean, 6 + b, 5, 1, C.skin);
	r(10 + lean, 5 + b, 1, 1, C.skinD);
	r(9 + lean, 6 + b, 1, 1, C.blush);
	if (a.blink) r(7 + lean, 5 + b, 2, 1, C.hair);
	else {
		r(8 + lean, 5 + b, 1, 1, C.eye);
	}
	if (a.mouth) r(9 + lean, 6 + b, 1, 1, C.mouth);
	// hat
	r(4 + lean, 1 + b, 6, 1, C.hat);
	r(3 + lean, 2 + b, 8, 1, C.hat);
	r(5 + lean, 1 + b, 2, 1, C.hatL);
	r(10 + lean, 2 + b, 1, 1, C.hatD);
	r(3 + lean, 3 + b, 8, 1, C.cuff);
	for (const x of [4, 6, 8, 10]) r(x + lean, 3 + b, 1, 1, C.cuffD);
	const px = a.pomX || 0, py = a.pomY || 0;
	r(4 + lean + px, 0 + b + py, 3, 1, C.pom);
	r(5 + lean + px, 1 + b + py - (py ? 1 : 0), 1, 1, C.pomD);
	if (!py) r(5 + lean + px, 0 + b - 0, 1, 1, C.pom);

	// --- front arm
	if (a.armF) arm(6 + lean, 9 + b, a.armF[0], a.armF[1] + b, C.jacket, C.skin);
}

export function approach(v, target, step) {
	return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export class Hiker {
	constructor({ P = 3, x = 0, y = 0, reduced = false } = {}) {
		this.P = P;
		this.w = 7 * P;
		this.h = 15 * P;
		this.x = x;
		this.y = y;
		this.vx = 0;
		this.vy = 0;
		this.face = 1;
		this.grounded = false;
		this.plat = null;
		this.coyote = 0;
		this.buffer = 0;
		this.landTimer = 0;
		this.skid = 0;
		this.phase = 0;
		this.time = Math.random() * 10;
		this.drop = 0;
		this.jc = 0;
		this.fx = [];
		this.reduced = reduced;
		this.wave = 0;
		this.air = 0;
		// Tuning (CSS px / s, scaled by P so the hiker feels the same at any pixel size).
		this.RUN = 98 * P;
		this.ACC = 700 * P;
		this.TURN = 1500 * P;
		this.FRIC = 1000 * P;
		this.AIR_ACC = 520 * P;
		this.AIR_FRIC = 150 * P;
		this.G = 800 * P;
		this.JUMP_H = 46 * P;
		this.MAXFALL = 400 * P;
		this.COYOTE = 0.1;
		this.BUFFER = 0.12;
		this.onEvent = null;
	}

	get cx() {
		return this.x + this.w / 2;
	}

	setJumpHeight(h) {
		this.JUMP_H = h;
	}

	update(dt, inp, world) {
		const P = this.P;
		this.time += dt;
		const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
		const wasGrounded = this.grounded;

		if (dir) {
			this.face = dir;
			const opposite = Math.sign(this.vx) === -dir && Math.abs(this.vx) > 20 * P;
			const acc = this.grounded ? (opposite ? this.TURN : this.ACC) : this.AIR_ACC;
			if (opposite && this.grounded && Math.abs(this.vx) > 60 * P) this.skid = 0.12;
			if (Math.abs(this.vx) <= this.RUN || Math.sign(this.vx) !== dir) {
				this.vx += dir * acc * dt;
				if (Math.abs(this.vx) > this.RUN && Math.sign(this.vx) === dir) this.vx = dir * this.RUN;
			}
		} else {
			this.vx = approach(this.vx, 0, (this.grounded ? this.FRIC : this.AIR_FRIC) * dt);
		}
		this.skid = Math.max(0, this.skid - dt);

		if (inp.jumpCount !== this.jc) {
			this.jc = inp.jumpCount;
			this.buffer = this.BUFFER;
		} else this.buffer -= dt;
		this.coyote = this.grounded ? this.COYOTE : this.coyote - dt;
		this.drop -= dt;

		if (this.buffer > 0) {
			if (inp.down && this.grounded && this.plat?.oneWay) {
				this.drop = 0.22;
				this.y += 2;
				this.grounded = false;
				this.buffer = 0;
			} else if (this.coyote > 0) {
				const v0 = Math.sqrt(2 * this.G * this.JUMP_H);
				this.vy = -v0;
				this.grounded = false;
				this.coyote = 0;
				this.buffer = 0;
				this.burst(this.cx, this.y + this.h, 4, 0.6);
				this.onEvent?.("jump");
			}
		}

		let g = this.G;
		if (this.vy < 0 && !inp.jump) g *= 2.7;
		else if (this.vy > 0) g *= 1.28;
		if (Math.abs(this.vy) < 70 * P && inp.jump && !this.grounded) g *= 0.62;
		this.vy = Math.min(this.vy + g * dt, this.MAXFALL);

		this.move(dt, world);

		if (this.grounded && !wasGrounded) {
			const impact = this._impact;
			if (impact > 170 * P) {
				this.landTimer = 0.13;
				this.burst(this.cx, this.y + this.h, 7, 1);
				this.onEvent?.("land", impact);
			}
		}
		this.landTimer = Math.max(0, this.landTimer - dt);
		if (this.grounded) {
			this.air = 0;
			if (Math.abs(this.vx) > 12 * P) this.phase += (Math.abs(this.vx) * dt) / (13 * P);
			if (this.skid > 0 && Math.random() < 0.5) this.burst(this.cx - this.face * 4, this.y + this.h, 1, 0.5);
		} else {
			this.air += dt;
		}
		this.wave = Math.max(0, this.wave - dt);
		this.fxStep(dt);
	}

	move(dt, world) {
		const { platforms, solids = [], bounds } = world;
		const prevBottom = this.y + this.h;
		this.x += this.vx * dt;
		if (bounds) {
			if (this.x < bounds.left) {
				this.x = bounds.left;
				this.vx = Math.max(0, this.vx);
			}
			if (this.x + this.w > bounds.right) {
				this.x = bounds.right - this.w;
				this.vx = Math.min(0, this.vx);
			}
		}
		for (const s of solids) {
			if (this.y < s.y + s.h && this.y + this.h > s.y && this.x < s.x + s.w && this.x + this.w > s.x) {
				const left = this.x + this.w - s.x, right = s.x + s.w - this.x;
				if (left < right) this.x -= left;
				else this.x += right;
				this.vx = 0;
			}
		}
		this._impact = this.vy;
		this.y += this.vy * dt;
		let landed = null;
		if (this.vy >= 0) {
			const bottom = this.y + this.h;
			const tol = 2 + this.vy * dt;
			for (const p of platforms) {
				if (this.drop > 0 && p.oneWay) continue;
				if (this.x + this.w <= p.x + 3 || this.x >= p.x + p.w - 3) continue;
				if (prevBottom <= p.y + tol && bottom >= p.y && (!landed || p.y < landed.y)) landed = p;
			}
			for (const s of solids) {
				if (this.x + this.w <= s.x || this.x >= s.x + s.w) continue;
				if (prevBottom <= s.y + tol && bottom >= s.y && (!landed || s.y < landed.y)) landed = s;
			}
		} else {
			for (const s of solids) {
				if (this.x + this.w <= s.x || this.x >= s.x + s.w) continue;
				if (this.y < s.y + s.h && this.y + this.h > s.y + s.h) {
					this.y = s.y + s.h;
					this.vy = 0;
				}
			}
		}
		if (landed) {
			this.y = landed.y - this.h;
			this.vy = 0;
			this.grounded = true;
			this.plat = landed;
		} else {
			this.grounded = false;
			this.plat = null;
		}
		if (bounds && bounds.floor != null && this.y + this.h > bounds.floor) {
			this.y = bounds.floor - this.h;
			this.vy = 0;
			this.grounded = true;
		}
	}

	burst(x, y, n, power = 1) {
		if (this.reduced) return;
		for (let i = 0; i < n; i++) {
			const s = (Math.random() - 0.5) * 2;
			this.fx.push({ x: x + s * 6, y: y - 1, vx: s * 70 * power * (this.P / 3), vy: -(10 + Math.random() * 40) * power, life: 0.35 + Math.random() * 0.2, max: 0.5 });
		}
	}

	fxStep(dt) {
		for (const f of this.fx) {
			f.life -= dt;
			f.x += f.vx * dt;
			f.y += f.vy * dt;
			f.vy += 40 * dt;
		}
		this.fx = this.fx.filter((f) => f.life > 0);
	}

	pose() {
		const a = { pose: "idle", legs: [[0, 0], [0, 0]], b: 0 };
		const t = this.time;
		const sp = Math.abs(this.vx);
		const P = this.P;
		a.blink = (t % 3.7) < 0.14;
		if (this.wave > 0) {
			a.armF = [10, 3 + (Math.sin(t * 16) > 0 ? 0 : 1)];
			a.mouth = true;
		}
		if (!this.grounded) {
			const rising = this.vy < 0;
			a.pose = rising ? "jump" : "fall";
			if (rising) {
				a.legs = [[1, -2], [-2, -1]];
				a.armF = a.armF || [9, 4];
				a.armB = [3, 5];
				a.pomY = 1;
				a.pomX = -1;
				a.packY = 1;
				a.scarfX = -1;
				a.scarfY = 1;
			} else {
				a.legs = [[2, -1], [-2, 0]];
				a.armF = a.armF || [10, 5];
				a.armB = [2, 6];
				a.pomY = -0;
				a.pomX = -1;
				a.packY = -1;
				a.scarfX = -1;
				a.scarfY = -1;
			}
			a.mouth = true;
			return a;
		}
		if (this.landTimer > 0) {
			a.pose = "land";
			a.b = this.landTimer > 0.06 ? 2 : 1;
			a.short = a.b === 2;
			a.legs = [[1, 0], [-1, 0]];
			a.armF = [8, 10];
			a.armB = [3, 10];
			a.pomY = 1;
			a.packY = 1;
			return a;
		}
		if (this.skid > 0) {
			a.pose = "skid";
			a.lean = -1;
			a.legs = [[2, 0], [1, 0]];
			a.armF = [9, 8];
			a.armB = [3, 8];
			a.pomX = 1;
			a.scarfX = 1;
			return a;
		}
		if (sp > 14 * P) {
			const ph = this.phase * Math.PI * 2 / 1.0;
			const s = Math.sin(ph), c = Math.cos(ph);
			const f = (sn, cs) => [Math.round(2.5 * sn), cs > 0 ? -Math.round(1.9 * cs) : 0];
			a.pose = "run";
			a.legs = [f(s, c), f(-s, -c)];
			a.b = Math.cos(ph * 2) < -0.25 ? 1 : 0;
			const sw = Math.round(2.3 * s);
			a.armF = a.armF || [7 - sw, 10 - (c > 0.6 ? 0 : 0)];
			a.armB = [6 + sw, 10];
			a.pomX = -Math.min(2, Math.round(sp / (60 * P)));
			a.pomY = a.b ? 0 : 0;
			a.scarfX = -1;
			a.scarfY = a.b;
			a.packY = a.b ? 0 : -0;
			a.lean = sp > 80 * P ? 0 : 0;
			return a;
		}
		// idle: slow breathing
		const br = Math.sin(t * 2.2) > 0.55 ? 1 : 0;
		a.b = br;
		a.legs = [[0, 0], [0, 0]];
		a.armF = [7, 10];
		a.armB = [5, 10];
		a.pomX = br ? 0 : 0;
		return a;
	}

	draw(ctx, offX, offY) {
		const P = this.P;
		const a = this.pose();
		const ox = Math.round(this.x + this.w / 2 - 6 * P - offX);
		const oy = Math.round(this.y + this.h - 16 * P - offY);
		// shadow-ish dust first
		for (const f of this.fx) {
			const al = Math.max(0, f.life / f.max);
			ctx.fillStyle = `rgba(245,238,225,${(al * 0.8).toFixed(2)})`;
			const s = Math.max(1, Math.round(P * (0.6 + al * 0.9)));
			ctx.fillRect(Math.round(f.x - offX), Math.round(f.y - offY), s, s);
		}
		drawHiker(ctx, ox, oy, P, this.face, a);
	}
}
