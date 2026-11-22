// _sq/sq.js: wraps #452 rn-dark-tuned and swaps its link squiggles for a spec-driven one (#454-478).
//  - the vs4 star squiggle is disabled cleanly: links are renamed .site-link -> .sq-link, so neither site.css's ::after mask nor
//    _vs4's pointer/canvas code matches them any more (a MutationObserver renames links again if the motion toggle re-mounts the page).
//  - at rest: one SVG data-URI background per link and mode (nothing runs). Wrapped lines work (box-decoration-break: clone, 100% width).
//  - on hover/focus: a fixed SVG overlay is created, one <svg> per line box (getClientRects), drawn by the same spec.draw with a live
//    state, and removed after. Motion advances only while the pointer moves, holds when it stops, eases back on leave, and is a
//    single static pose when paused (.t2-paused), reduce-motion or prefers-reduced-motion.
import { r2, cl, hash } from "./draw.js";

const REST = { p: 0, h: 0, t: 0, sx: 0, x: null, near: 0 };
const isDark = () => document.documentElement.classList.contains("dark");
const svgNS = "http://www.w3.org/2000/svg";

export function withSq(baseActivate, spec) {
	return function activate(ctx) {
		const { root } = ctx;
		// Josh's new headshot (+ person mask) for both portrait images, before #452 / _vs4/portrait.js reads them
		const shot = new URL("../../assets/headshot-512.webp", import.meta.url).href, shotMask = new URL("../../assets/headshot-mask-512.png", import.meta.url).href;
		// fresh <img> elements: an existing one would keep reporting its old currentSrc (which _vs4/portrait.js reads) until the new image loads
		for (const img of root.querySelectorAll(".site-portrait-light, .site-portrait-dark")) {
			const n = document.createElement("img");
			n.className = img.className; n.setAttribute("alt", img.getAttribute("alt") ?? "");
			n.setAttribute("data-mask", shotMask); n.src = shot;
			img.replaceWith(n);
		}
		const cleanBase = baseActivate(ctx);
		const geo = new WeakMap();
		const act = new Map();
		let layer = null, raf = 0, last = 0, uidN = 0, dead = false, lastPtr = { x: -1, y: -1 }, proxQueued = false;
		const html = document.documentElement;
		const moving = () => !root.classList.contains("t2-paused") && !html.classList.contains("reduce-motion") && !matchMedia("(prefers-reduced-motion: reduce)").matches;

		/* ---------- geometry + resting backgrounds ---------- */
		const mkEnv = (g, dark, w, s, id) => ({
			dark, fs: g.fs, sw: g.sw, H: g.H, M: g.halfH, w, W: w == null ? "100%" : r2(w), s, id,
			nav: !!g.nav, A: spec.amp * g.fs, P: Math.max(4, Math.round(spec.per * g.fs)), seed: g.seed, X: (f) => (w == null ? `${r2(f * 100)}%` : r2(f * w)),
		});
		const restSvg = (g, dark) => {
			const inner = spec.draw(mkEnv(g, dark, spec.tile || g.nav ? g.tileW : null, REST, "r"));
			return `<svg xmlns="${svgNS}" height="${g.H}"${spec.tile || g.nav ? ` width="${g.tileW}"` : ""}>${inner}</svg>`;
		};
		function prep(list) {
			if (dead || !list.length) return;
			for (const a of list) a.style.removeProperty("--sq-pb");
			const probes = list.map((a) => { const s = document.createElement("span"); s.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; a.append(s); return s; });
			const ms = list.map((a, i) => {
				const rs = a.getClientRects(), lastR = rs[rs.length - 1], cs = getComputedStyle(a);
				const wmax = Math.max(0, ...[...rs].map((r) => r.width));
				return { fs: parseFloat(cs.fontSize) || 16, desc: lastR ? lastR.bottom - probes[i].getBoundingClientRect().bottom : 4, wmax };
			});
			probes.forEach((s) => s.remove());
			list.forEach((a, i) => {
				const { fs, desc, wmax } = ms[i];
				const isNav = a.classList.contains("sq-static"), blockish = getComputedStyle(a).display !== "inline";
				const sw = isNav && spec.navSw ? spec.navSw : spec.sw ? spec.sw(fs) : cl(fs * 0.0625, 1, 1.3);
				const halfH = spec.halfH ? Math.ceil(spec.halfH(fs, sw)) : Math.ceil(spec.amp * fs + sw + 2);
				let drop = (spec.drop ?? 0.26) * fs;
				const pb = Math.max(0, drop + halfH - desc); // block-level links (nav flex items) cancel this padding with a negative margin, see base.css
				const up = desc + pb - drop - halfH;
				const g = { nav: isNav, fs, sw, halfH, H: halfH * 2, up, pb, desc, seed: hash(a.textContent || "x"), tileW: isNav ? Math.round(wmax) : Math.ceil(wmax) + 8 };
				geo.set(a, g);
				a.style.setProperty("--sq-pb", `${r2(pb)}px`);
				a.style.setProperty("--sq-h", `${g.H}px`);
				a.style.setProperty("--sq-by", `calc(100% - ${r2(up)}px)`);
				if (spec.tile || isNav) a.style.setProperty("--sq-bw", `${g.tileW}px`);
				if (spec.rest === false) return;
				for (const dark of [true, false]) {
					const url = `url("data:image/svg+xml,${encodeURIComponent(restSvg({ ...g, w: g.tileW }, dark))}")`;
					a.style.setProperty(dark ? "--sq-d" : "--sq-l", url);
				}
			});
		}
		const mine = () => [...root.querySelectorAll("a.site-link, a.sq-link")];
		function adopt() {
			if (dead) return;
			const list = [];
			for (const a of root.querySelectorAll("a.site-link")) { a.classList.remove("site-link"); a.classList.add("sq-link"); list.push(a); }
			if (spec.nav) for (const a of root.querySelectorAll(".site-nav-link.is-active:not(.sq-link)")) { a.classList.add("sq-link", "sq-static"); list.push(a); }
			if (list.length) prep(list);
		}
		adopt(); // synchronous: links are renamed before the first paint of this theme
		const mo = new MutationObserver(() => adopt());
		mo.observe(root, { childList: true, subtree: true });
		document.fonts?.ready.then(() => { if (!dead) prep(mine().filter((a) => a.classList.contains("sq-link"))); });
		let rz = 0;
		const onResize = () => { clearTimeout(rz); rz = setTimeout(() => prep(mine().filter((a) => a.classList.contains("sq-link"))), 160); };
		addEventListener("resize", onResize, { passive: true });

		/* ---------- hover overlay ---------- */
		if (spec.hover) {
			const ensureLayer = () => {
				if (layer) return;
				layer = document.createElement("div");
				layer.setAttribute("aria-hidden", "true");
				layer.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:12;overflow:hidden";
				document.body.append(layer);
			};
			const start = (a, src, e) => {
				if (!geo.has(a) || a.classList.contains("sq-static")) return null;
				let st = act.get(a);
				if (!st) {
					ensureLayer();
					st = { a, src, n: uidN++, g: 0, gT: 0, tm: 0, h: 0, hT: 1, p: 0, pT: 0, t: 0, sx: 0, x: null, near: 0, nearT: 0, lx: e?.clientX ?? null, leaving: false, born: true };
					act.set(a, st);
				}
				st.leaving = false; st.hT = 1;
				return st;
			};
			const setStatic = (st) => { st.h = 1; st.p = spec.staticP ?? 0.6; st.t = 0; st.sx = 0; st.tm = 0; st.near = 1; st.nearT = 1; st.x = null; };
			const leave = (a) => { const st = act.get(a); if (!st) return; st.leaving = true; st.hT = 0; st.pT = 0; st.nearT = 0; wake(); };
			const onOver = (e) => {
				if (e.pointerType === "touch") return;
				const a = e.target?.closest?.(".sq-link"); if (!a) return;
				const st = start(a, spec.prox ? "prox" : "ptr", e); if (!st) return;
				st.gT = 1;
				if (spec.prox) { st.leaving = false; st.lx = e.clientX; if (!moving()) { setStatic(st); wake(); } else wake(); return; }
				st.src = "ptr"; st.lx = e.clientX; st.px = e.clientX; st.near = st.nearT = 1;
				if (!moving()) setStatic(st);
				wake();
			};
			const onMove = (e) => {
				if (spec.prox || e.pointerType === "touch") return;
				const a = e.target?.closest?.(".sq-link"); if (!a) return;
				let st = act.get(a);
				if (!st || st.leaving) st = start(a, "ptr", e);
				if (!st || !moving()) return;
				if (st.lx != null) {
					const dx = e.clientX - st.lx, d = Math.abs(dx);
					st.p = Math.min(1, st.p + d / (spec.travel ?? 320) + 0.002);
					st.t += d; st.sx += dx;
				}
				st.lx = e.clientX; st.px = e.clientX; wake();
			};
			const onOut = (e) => {
				const a = e.target?.closest?.(".sq-link"); if (!a || a.contains(e.relatedTarget)) return;
				if (spec.prox) { const st = act.get(a); if (st) { st.gT = 0; if (!moving()) leave(a); wake(); } } else leave(a);
			};
			const onFocusIn = (e) => {
				const a = e.target?.closest?.(".sq-link"); if (!a || !a.matches(":focus-visible")) return;
				const st = start(a, "focus", e); if (!st) return;
				st.src = "focus"; st.gT = 1; st.near = st.nearT = 1; st.pT = spec.staticP ?? 0.6; st.x = null;
				if (!moving()) setStatic(st);
				wake();
			};
			const onFocusOut = (e) => { const a = e.target?.closest?.(".sq-link"); if (a) { const st = act.get(a); if (st) st.gT = 0; leave(a); } };
			root.addEventListener("pointerover", onOver, { passive: true });
			root.addEventListener("pointermove", onMove, { passive: true });
			root.addEventListener("pointerout", onOut, { passive: true });
			root.addEventListener("focusin", onFocusIn);
			root.addEventListener("focusout", onFocusOut);
			root.addEventListener("scroll", () => { if (act.size) wake(); }, { passive: true });

			/* proximity mode: window pointer, distance to each link */
			const R = spec.proxR ?? 90;
			const proxScan = () => {
				proxQueued = false; if (dead) return;
				const links = [...root.querySelectorAll(".sq-link:not(.sq-static)")], vh = innerHeight;
				for (const a of links) {
					const rs = a.getClientRects(); let d = 1e9;
					for (const r of rs) {
						if (r.bottom < -R || r.top > vh + R) continue;
						const dx = Math.max(r.left - lastPtr.x, 0, lastPtr.x - r.right), dy = Math.max(r.top - lastPtr.y, 0, lastPtr.y - r.bottom);
						d = Math.min(d, Math.hypot(dx, dy));
					}
					const near = d < R ? 1 - d / R : 0;
					let st = act.get(a);
					if (near > 0.01) { if (!st) st = start(a, "prox"); if (st) { st.leaving = false; st.nearT = near; st.h = Math.max(st.h, 0); st.hT = 1; } }
					else if (st && !st.leaving && st.src !== "focus" && !st.gT) { st.nearT = 0; st.leaving = true; st.hT = 0; }
				}
				wake();
			};
			const onProx = (e) => {
				if (e.pointerType === "touch") return;
				lastPtr = { x: e.clientX, y: e.clientY };
				if (!moving()) return;
				if (!proxQueued) { proxQueued = true; requestAnimationFrame(proxScan); }
			};
			const onProxOut = (e) => { if (!e.relatedTarget) for (const st of act.values()) if (st.src !== "focus") { st.nearT = 0; st.gT = 0; st.leaving = true; st.hT = 0; } wake(); };
			if (spec.prox) { addEventListener("pointermove", onProx, { passive: true }); document.addEventListener("pointerout", onProxOut, { passive: true }); }

			const render = () => {
				let out = "";
				for (const st of act.values()) {
					const g = geo.get(st.a); if (!g) continue;
					const rs = [...st.a.getClientRects()].filter((r) => r.width > 1);
					const dark = isDark();
					rs.forEach((r, i) => {
						const w = r.width;
						const s = { p: st.p, h: st.h, t: st.t, sx: st.sx, near: st.near, g: st.g, tm: st.tm, x: st.src === "focus" || !moving() ? w * 0.5 : spec.prox ? lastPtr.x - r.left : st.px == null ? w * 0.5 : st.px - r.left, i, n: rs.length };
						const e = mkEnv(g, dark, w, s, `${st.n}_${i}`);
						const top = r.bottom - g.up - g.H;
						out += `<svg xmlns="${svgNS}" style="position:absolute;left:${r2(r.left)}px;top:${r2(top)}px;overflow:visible" width="${r2(w)}" height="${g.H}">${spec.draw(e)}</svg>`;
					});
				}
				if (layer) layer.innerHTML = out;
			};
			const frame = (now) => {
				raf = 0; if (dead) return;
				const dt = Math.min(0.08, last ? (now - last) / 1000 : 0.016); last = now;
				let busy = false;
				const still = !moving();
				for (const [a, st] of act) {
					if (!a.isConnected) { act.delete(a); continue; }
					if (still) { if (st.leaving) { act.delete(a); a.removeAttribute("data-sq-live"); continue; } setStatic(st); }
					else {
						const kh = 1 - Math.exp(-dt * (st.hT ? 11 : 9)), kp = 1 - Math.exp(-dt * (st.leaving ? 5 : 8));
						st.h += (st.hT - st.h) * kh;
						st.g += (st.gT - st.g) * (1 - Math.exp(-dt * (st.gT ? 4 : 3)));
						if (spec.live) { st.tm += dt * (spec.prox ? st.near * st.near : st.g); if (st.near > 0.004 || st.g > 0.004) busy = true; }
						if (st.leaving || st.src === "focus") st.p += (st.pT - st.p) * kp;
						if (st.leaving) { st.sx *= 1 - kp; st.t *= 1 - kp; }
						if (spec.prox) st.near += (st.nearT - st.near) * (1 - Math.exp(-dt * 10));
						if (Math.abs(st.hT - st.h) > 0.004 || (st.leaving && (st.p > 0.004 || Math.abs(st.sx) > 0.3)) || (st.src === "focus" && Math.abs(st.pT - st.p) > 0.004) || (spec.prox && Math.abs(st.nearT - st.near) > 0.004)) busy = true;
						if (st.leaving && st.h < 0.01 && st.p < 0.01 && (spec.live || st.g < 0.01) && (!spec.prox || st.near < 0.01)) { act.delete(a); a.removeAttribute("data-sq-live"); continue; }
					}
					if (!a.hasAttribute("data-sq-live")) a.setAttribute("data-sq-live", "");
				}
				render();
				if (!act.size && layer) { layer.remove(); layer = null; }
				if (busy) raf = requestAnimationFrame(frame); else last = 0;
			};
			var wake = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };
			var cleanHover = () => {
				root.removeEventListener("pointerover", onOver); root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerout", onOut);
				root.removeEventListener("focusin", onFocusIn); root.removeEventListener("focusout", onFocusOut);
				removeEventListener("pointermove", onProx); document.removeEventListener("pointerout", onProxOut);
			};
		} else { var wake = () => {}; var cleanHover = () => {}; }

		return () => {
			dead = true; cancelAnimationFrame(raf); mo.disconnect(); clearTimeout(rz);
			removeEventListener("resize", onResize); cleanHover();
			layer?.remove(); layer = null;
			if (typeof cleanBase === "function") cleanBase();
		};
	};
}
