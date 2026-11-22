const NS = "http://www.w3.org/2000/svg";
const SLOPE = 0.24;
const TAPE = 11;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

function hiHtml(src) {
	return esc(src).replace(
		/(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([a-zA-Z][\w-]*)|(\s)([\w:-]+)(=)("[^"]*")|(\/?&gt;)/g,
		(m, c, o, tag, sp, an, eq, av, close) =>
			c ? `<i class="cm">${c}</i>`
			: tag ? `<i class="pu">${o}</i><i class="tg">${tag}</i>`
			: an ? `${sp}<i class="at">${an}</i><i class="pu">${eq}</i><i class="st">${av}</i>`
			: `<i class="pu">${close}</i>`,
	);
}

function hiCss(src) {
	let inComment = false;
	return src.split("\n").map((line) => {
		const e = esc(line);
		if (inComment || /^\s*\/\*/.test(line)) {
			inComment = !/\*\//.test(line);
			return `<i class="cm">${e}</i>`;
		}
		let m;
		if ((m = line.match(/^(\s*)([\w-]+)(\s*:\s*)(.*?)(;?)\s*$/)) && !/\{\s*$/.test(line)) {
			return `${esc(m[1])}<i class="pr">${esc(m[2])}</i><i class="pu">${esc(m[3])}</i><i class="vl">${esc(m[4])}</i><i class="pu">${m[5]}</i>`;
		}
		if (/\{\s*$/.test(line)) return `<i class="sl">${e.replace(/\{\s*$/, "")}</i><i class="pu">{</i>`;
		return `<i class="pu">${e}</i>`;
	}).join("\n");
}

const lines = (html) => html.split("\n").map((l) => `<span class="l">${l || " "}</span>`).join("");

export function create(root, reduced, theme, onClosed) {
	const page = root.querySelector(".site-page");
	let host;
	let panes = [];
	let t = 0; // 0..1 zipping, 1..2 flaps opening
	let target = 0;
	let raf = 0;
	let last = 0;
	let dragging = false;
	let W = 0;
	let H = 0;
	let geo = {};
	let isOpen = false;
	let prevFocus;
	const SPEED = { zip: 1 / 1.7, flap: 1 / 0.75 };

	async function sources() {
		const [css, themeCss] = await Promise.all([
			fetch("site.css").then((r) => r.text()).catch(() => "/* site.css unavailable */"),
			fetch(`themes/${theme.id}.css`).then((r) => r.text()).catch(() => ""),
		]);
		const clone = page.cloneNode(true);
		for (const el of clone.querySelectorAll("[data-xr], [style]")) el.removeAttribute("style");
		const markup = clone.outerHTML.replace(/^\t{0,3}/gm, "");
		return { markup, css: `${css.trim()}\n\n/* ---- themes/${theme.id}.css ---- */\n\n${themeCss.trim()}` };
	}

	function build(src) {
		host = document.createElement("div");
		host.className = "zp";
		const rr = root.getBoundingClientRect();
		W = Math.round(rr.width);
		H = Math.round(rr.height);

		const srcEl = document.createElement("div");
		srcEl.className = "zp-src";
		const file = (name, body, hi) => `<section class="zp-file"><header><i></i><span>${name}</span><span>${body.split("\n").length} lines · ${(new Blob([body]).size / 1024).toFixed(1)} kB</span></header><pre tabindex="0">${lines(hi(body))}</pre></section>`;
		srcEl.innerHTML = file("index.html", src.markup, hiHtml) + file("site.css + theme", src.css, hiCss);
		host.append(srcEl);

		if (!reduced) {
			const pr = page.getBoundingClientRect();
			for (const side of ["l", "r"]) {
				const pane = document.createElement("div");
				pane.className = `zp-pane ${side}`;
				const clone = document.createElement("div");
				clone.className = "zp-clone";
				clone.setAttribute("aria-hidden", "true");
				clone.style.cssText = `left:${pr.left - rr.left}px;top:${pr.top - rr.top}px;width:${pr.width}px`;
				clone.append(page.cloneNode(true));
				const svg = document.createElementNS(NS, "svg");
				svg.setAttribute("class", "zp-svg");
				svg.setAttribute("width", W);
				svg.setAttribute("height", H);
				svg.innerHTML = '<path class="tape" fill="none" stroke="#18284a" stroke-width="20"/><path class="tape2" fill="none" stroke="#18284a" stroke-width="20"/><path class="teeth" fill="none" stroke="#6a7589" stroke-width="10" stroke-dasharray="6 4"/><path class="teeth2" fill="none" stroke="#6a7589" stroke-width="10" stroke-dasharray="6 4"/><path class="hi" fill="none" stroke="#e4e9f2" stroke-width="7" stroke-dasharray="6 4"/><path class="hi2" fill="none" stroke="#e4e9f2" stroke-width="7" stroke-dasharray="6 4"/>';
				pane.append(clone, svg);
				host.append(pane);
				panes.push({ pane, svg, side });
			}
			const top = document.createElementNS(NS, "svg");
			top.setAttribute("class", "zp-top");
			top.setAttribute("width", W);
			top.setAttribute("height", H);
			top.innerHTML = `<defs><linearGradient id="zp-m" x1="0" x2="1"><stop offset="0" stop-color="#9aa4b8"/><stop offset=".45" stop-color="#f2f5fb"/><stop offset="1" stop-color="#7d889f"/></linearGradient></defs>
<g class="zp-pull" tabindex="0" role="slider" aria-label="Zipper" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><rect x="-14" y="-18" width="28" height="36" rx="8" fill="url(#zp-m)" stroke="#59647a"/><rect x="-5" y="-9" width="10" height="16" rx="3" fill="#59647a" opacity=".55"/><path fill-rule="evenodd" fill="url(#zp-m)" stroke="#59647a" d="M-8 16h16a2 2 0 0 1 2 2v34a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V18a2 2 0 0 1 2-2zM0 38a3.4 3.4 0 1 0 .01 0z"/></g>`;
			host.append(top);
			panes.top = top;
		}

		const close = document.createElement("button");
		close.className = "zp-close";
		close.type = "button";
		close.textContent = "Zip it back up · Esc";
		close.addEventListener("click", () => api.close());
		host.append(close);
		root.append(host);
		bindPull();
	}

	function layout() {
		const cx = W / 2;
		const p = Math.min(1, t);
		const q = Math.max(0, t - 1);
		const headY = p * H;
		const w0 = headY * SLOPE;
		geo = { cx, headY, w0, q };
		if (reduced) return;
		const slide = ease(q) * cx * 0.92;
		for (const { pane, svg, side } of panes) {
			const poly = `polygon(0 0,${cx - w0}px 0,${cx}px ${headY}px,${cx}px ${H}px,0 ${H}px)`;
			if (side === "l") {
				pane.style.clipPath = poly;
				pane.style.transform = `translateX(${-slide}px)`;
			} else {
				pane.style.clipPath = `polygon(${W}px 0,${W - cx + w0}px 0,${W - cx}px ${headY}px,${W - cx}px ${H}px,${W}px ${H}px)`;
				pane.style.transform = `translateX(${slide}px)`;
			}
			const A = [cx - w0, 0];
			const B = [cx, headY];
			const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
			const d = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
			const n = [-d[1], d[0]];
			const f = (o) => `M${(A[0] + n[0] * o).toFixed(1)} ${(A[1] + n[1] * o).toFixed(1)}L${(B[0] + n[0] * o).toFixed(1)} ${(B[1] + n[1] * o).toFixed(1)}`;
			const vert = (o) => `M${cx - o} ${headY.toFixed(1)}V${H}`;
			// Right pane is mirrored by CSS; its teeth sit half a tooth out of phase so they interlock.
			const off = side === "r" ? 5 : 0;
			const set = (cls, dd, dash) => {
				const el = svg.querySelector(`.${cls}`);
				el.setAttribute("d", dd);
				if (dash !== undefined) el.setAttribute("stroke-dashoffset", dash);
			};
			set("tape", f(TAPE + 1)); set("tape2", vert(TAPE + 1));
			set("teeth", f(5), 0); set("teeth2", vert(5), off);
			set("hi", f(5), 0); set("hi2", vert(5), off);
			// stroke widths: teeth drawn wider underneath, highlight on top
		}
		const pull = panes.top.querySelector(".zp-pull");
		pull.setAttribute("transform", `translate(${cx} ${headY})`);
		pull.setAttribute("aria-valuenow", String(Math.round(p * 100)));
		pull.style.opacity = q > 0 ? String(Math.max(0, 1 - q * 2)) : "1";
	}

	function frame(now) {
		raf = 0;
		if (!isOpen) return;
		const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
		last = now;
		if (!dragging) {
			const dir = Math.sign(target - t);
			if (dir) {
				const sp = t < 1 && target <= 1 ? SPEED.zip : t > 1 || target > 1 ? (t >= 1 ? SPEED.flap : SPEED.zip) : SPEED.zip;
				t += dir * sp * dt;
				if ((dir > 0 && t >= target) || (dir < 0 && t <= target)) t = target;
			}
		}
		layout();
		if (t !== target || dragging) raf = requestAnimationFrame(frame);
		else {
			last = 0;
			if (target === 0 && !isOpen) finish();
		}
	}
	const go = (to) => { target = to; last = 0; raf ||= requestAnimationFrame(frame); };

	function bindPull() {
		if (reduced) return;
		const pull = panes.top.querySelector(".zp-pull");
		pull.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			pull.setPointerCapture(e.pointerId);
			dragging = true;
			const rr = host.getBoundingClientRect();
			const move = (ev) => {
				t = Math.max(0, Math.min(1, (ev.clientY - rr.top - 24) / H));
				if (!raf) raf = requestAnimationFrame(frame);
			};
			const up = () => {
				pull.removeEventListener("pointermove", move);
				dragging = false;
				go(t > 0.3 ? 2 : 0);
			};
			pull.addEventListener("pointermove", move);
			pull.addEventListener("pointerup", up, { once: true });
			pull.addEventListener("pointercancel", up, { once: true });
		});
		pull.addEventListener("keydown", (e) => {
			if (e.key === "ArrowDown") { e.preventDefault(); go(Math.min(2, Math.ceil(t * 4 + 0.01) / 4)); }
			if (e.key === "ArrowUp") { e.preventDefault(); go(Math.max(0, Math.floor(t * 4 - 0.01) / 4)); }
		});
	}

	function finish() {
		host?.remove();
		host = undefined;
		panes = [];
		prevFocus?.focus?.();
	}

	const api = {
		async open() {
			if (isOpen) return;
			isOpen = true;
			prevFocus = document.activeElement;
			const src = await sources();
			if (!isOpen) return;
			build(src);
			t = reduced ? 2 : 0;
			layout();
			host.querySelector(".zp-close").focus({ preventScroll: true });
			if (!reduced) setTimeout(() => isOpen && !dragging && go(2), 350);
		},
		close() {
			if (!isOpen) return;
			isOpen = false;
			onClosed();
			if (reduced || !host) return finish();
			isOpen = true; // keep animating until fully zipped
			target = 0;
			last = 0;
			const run = (now) => {
				raf = 0;
				const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
				last = now;
				t = Math.max(0, t - (t > 1 ? SPEED.flap : SPEED.zip) * 1.2 * dt);
				layout();
				if (t > 0) raf = requestAnimationFrame(run);
				else { isOpen = false; finish(); }
			};
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(run);
		},
		destroy() {
			isOpen = false;
			cancelAnimationFrame(raf);
			host?.remove();
		},
	};
	return api;
}
