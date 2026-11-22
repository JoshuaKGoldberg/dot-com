// Clavet-style double-density relaxation fluid in "h units" (interaction radius = 1).
// Pure module: no DOM. Positions/velocities are Float32Arrays of length 2N.

export class Fluid {
	constructor({ n, width, height, spacing, k = 0.9, kNear = 2.4, visc = 0.04 }) {
		this.n = n;
		this.W = width; // container size in h units
		this.H = height;
		this.k = k;
		this.kNear = kNear;
		this.visc = visc;
		this.x = new Float32Array(n * 2);
		this.v = new Float32Array(n * 2);
		this.p = new Float32Array(n * 2); // previous positions
		this.cols = Math.max(1, Math.ceil(width));
		this.rows = Math.max(1, Math.ceil(height));
		this.cellHead = new Int32Array(this.cols * this.rows);
		this.next = new Int32Array(n);
		this.rho = new Float32Array(n);
		this.rhoN = new Float32Array(n);
		this.gx = 0;
		this.gy = 0.004;
		this.spacing = spacing;
		this.rho0 = 0;
		this.speed = 0;
		this.obstacles = []; // {x,y,r,vx,vy}
		this.sleepy = 0;
	}

	/** Fill a hex-ish lattice from the floor up; also measures rest density. */
	fill(fillHeight) {
		const s = this.spacing;
		const cols = Math.floor(this.W / s);
		let i = 0;
		for (let row = 0; i < this.n; row++) {
			for (let c = 0; c < cols && i < this.n; c++) {
				this.x[i * 2] = (c + 0.5 + (row % 2) * 0.5) * s;
				this.x[i * 2 + 1] = this.H - (row + 0.5) * s * 0.92;
				i++;
			}
		}
		this.p.set(this.x);
		this.v.fill(0);
		this.rho0 = this.measureRest();
	}

	measureRest() {
		// Rest density of an interior particle in the lattice we fill with.
		const s = this.spacing;
		let rho = 0;
		for (let a = -4; a <= 4; a++) {
			for (let b = -4; b <= 4; b++) {
				if (!a && !b) continue;
				const dx = (a + (b & 1) * 0.5) * s;
				const dy = b * s * 0.92;
				const d = Math.hypot(dx, dy);
				if (d < 1) rho += (1 - d) ** 2;
			}
		}
		return rho;
	}

	buildGrid() {
		this.cellHead.fill(-1);
		const { x, cols, rows } = this;
		for (let i = 0; i < this.n; i++) {
			const cx = Math.min(cols - 1, Math.max(0, x[i * 2] | 0));
			const cy = Math.min(rows - 1, Math.max(0, x[i * 2 + 1] | 0));
			const c = cy * cols + cx;
			this.next[i] = this.cellHead[c];
			this.cellHead[c] = i;
		}
	}

	step(dt) {
		const { x, v, p, n, W, H, cols, rows, cellHead, next, rho, rhoN } = this;
		const gx = this.gx * dt * dt;
		const gy = this.gy * dt * dt;
		// Gravity + viscosity (cheap XSPH-like pairwise damping).
		for (let i = 0; i < n; i++) {
			v[i * 2] += gx / dt;
			v[i * 2 + 1] += gy / dt;
		}
		this.buildGrid();
		const visc = this.visc;
		for (let i = 0; i < n; i++) {
			const xi = x[i * 2];
			const yi = x[i * 2 + 1];
			const cx = Math.min(cols - 1, Math.max(0, xi | 0));
			const cy = Math.min(rows - 1, Math.max(0, yi | 0));
			for (let oy = -1; oy <= 1; oy++) {
				const ny = cy + oy;
				if (ny < 0 || ny >= rows) continue;
				for (let ox = -1; ox <= 1; ox++) {
					const nx = cx + ox;
					if (nx < 0 || nx >= cols) continue;
					for (let j = cellHead[ny * cols + nx]; j !== -1; j = next[j]) {
						if (j <= i) continue;
						const dx = x[j * 2] - xi;
						const dy = x[j * 2 + 1] - yi;
						const d2 = dx * dx + dy * dy;
						if (d2 >= 1 || d2 < 1e-8) continue;
						const d = Math.sqrt(d2);
						const q = 1 - d;
						const nxv = dx / d;
						const nyv = dy / d;
						const u = (v[i * 2] - v[j * 2]) * nxv + (v[i * 2 + 1] - v[j * 2 + 1]) * nyv;
						if (u > 0) {
							const I = 0.5 * dt * q * visc * u;
							v[i * 2] -= I * nxv;
							v[i * 2 + 1] -= I * nyv;
							v[j * 2] += I * nxv;
							v[j * 2 + 1] += I * nyv;
						}
					}
				}
			}
		}
		for (let i = 0; i < n; i++) {
			p[i * 2] = x[i * 2];
			p[i * 2 + 1] = x[i * 2 + 1];
			x[i * 2] += v[i * 2] * dt;
			x[i * 2 + 1] += v[i * 2 + 1] * dt;
		}
		this.buildGrid();
		const k = this.k;
		const kn = this.kNear;
		const rho0 = this.rho0;
		const dt2 = dt * dt;
		for (let i = 0; i < n; i++) {
			const xi = x[i * 2];
			const yi = x[i * 2 + 1];
			const cx = Math.min(cols - 1, Math.max(0, xi | 0));
			const cy = Math.min(rows - 1, Math.max(0, yi | 0));
			let d1 = 0;
			let d2n = 0;
			for (let oy = -1; oy <= 1; oy++) {
				const ny = cy + oy;
				if (ny < 0 || ny >= rows) continue;
				for (let ox = -1; ox <= 1; ox++) {
					const nx = cx + ox;
					if (nx < 0 || nx >= cols) continue;
					for (let j = cellHead[ny * cols + nx]; j !== -1; j = next[j]) {
						if (j === i) continue;
						const dx = x[j * 2] - xi;
						const dy = x[j * 2 + 1] - yi;
						const dd = dx * dx + dy * dy;
						if (dd >= 1) continue;
						const q = 1 - Math.sqrt(dd);
						d1 += q * q;
						d2n += q * q * q;
					}
				}
			}
			const P = k * (d1 - rho0);
			const Pn = kn * d2n;
			let dxi = 0;
			let dyi = 0;
			for (let oy = -1; oy <= 1; oy++) {
				const ny = cy + oy;
				if (ny < 0 || ny >= rows) continue;
				for (let ox = -1; ox <= 1; ox++) {
					const nx = cx + ox;
					if (nx < 0 || nx >= cols) continue;
					for (let j = cellHead[ny * cols + nx]; j !== -1; j = next[j]) {
						if (j === i) continue;
						const dx = x[j * 2] - xi;
						const dy = x[j * 2 + 1] - yi;
						const dd = dx * dx + dy * dy;
						if (dd >= 1 || dd < 1e-10) continue;
						const d = Math.sqrt(dd);
						const q = 1 - d;
						const D = (dt2 * (P * q + Pn * q * q)) / d;
						x[j * 2] += (D * dx) * 0.5;
						x[j * 2 + 1] += (D * dy) * 0.5;
						dxi -= D * dx * 0.5;
						dyi -= D * dy * 0.5;
					}
				}
			}
			x[i * 2] += dxi;
			x[i * 2 + 1] += dyi;
		}
		// Obstacles (circles), boundaries, velocity from displacement.
		let sp = 0;
		for (let i = 0; i < n; i++) {
			let xi = x[i * 2];
			let yi = x[i * 2 + 1];
			for (const o of this.obstacles) {
				const dx = xi - o.x;
				const dy = yi - o.y;
				const d = Math.hypot(dx, dy);
				const r = o.r + 0.12;
				if (d < r && d > 1e-6) {
					xi = o.x + (dx / d) * r;
					yi = o.y + (dy / d) * r;
				}
			}
			const m = 0.12;
			if (xi < m) xi = m + (m - xi) * 0.0;
			if (xi > W - m) xi = W - m;
			if (yi > H - m) {
				yi = H - m;
				// floor friction
				p[i * 2] += (x[i * 2] - p[i * 2]) * 0.0;
			}
			if (yi < 0) yi = 0;
			x[i * 2] = xi;
			x[i * 2 + 1] = yi;
			v[i * 2] = (xi - p[i * 2]) / dt;
			v[i * 2 + 1] = (yi - p[i * 2 + 1]) / dt;
			sp += Math.abs(v[i * 2]) + Math.abs(v[i * 2 + 1]);
		}
		this.speed = sp / n;
	}
}
