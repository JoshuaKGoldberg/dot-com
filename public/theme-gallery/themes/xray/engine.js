const SKIP = new Set(["SCRIPT", "STYLE", "BR", "SVG", "PATH"]);

export function create(root, reduced, onExit) {
	const page = root.querySelector(".site-page");
	let tagged = [];
	let extras = [];
	let panel;
	let tip;
	let hovered;
	let raf = 0;
	let active = false;
	let base = { rx: 52, rz: -26 };
	let nudge = { x: 0, y: 0 };
	let leaveTimer = 0;

	const creates = (cs) =>
		cs.position === "fixed" || cs.position === "sticky" ||
		(cs.position !== "static" && cs.zIndex !== "auto") ||
		+cs.opacity < 1 || cs.transform !== "none" || cs.isolation === "isolate" ||
		cs.filter !== "none" || cs.mixBlendMode !== "normal" || cs.willChange !== "auto" || cs.contain !== "none";

	function collect() {
		const stats = { boxes: 0, depth: 0, grid: 0, flex: 0, sc: 1 };
		const walk = (el, depth) => {
			for (const child of el.children) {
				if (SKIP.has(child.tagName.toUpperCase())) continue;
				const cs = getComputedStyle(child);
				const isBox = cs.display !== "inline" && cs.display !== "none" && cs.display !== "contents";
				let d = depth;
				if (isBox) {
					const r = child.getBoundingClientRect();
					if (r.width > 2 && r.height > 2 && tagged.length < 220) {
						d = depth + 1;
						child.dataset.xr = "";
						child.style.setProperty("--xd", String(d));
						tagged.push(child);
						stats.boxes++;
						stats.depth = Math.max(stats.depth, d);
						if (creates(cs)) { child.classList.add("xr-sc"); stats.sc++; }
						if (/grid/.test(cs.display)) { stats.grid++; guides(child, cs, "grid"); }
						else if (/flex/.test(cs.display)) { stats.flex++; guides(child, cs, "flex"); }
					}
				}
				walk(child, d);
			}
		};
		walk(page, 0);
		return stats;
	}

	function guides(el, cs, kind) {
		if (getComputedStyle(el).position === "static") { el.style.position = "relative"; extras.push(() => (el.style.position = "")); }
		const box = document.createElement("div");
		box.className = "xr-lines";
		const bw = el.clientWidth;
		const bh = el.clientHeight;
		const px = (s) => (s && s !== "none" ? s.split(" ").map(parseFloat).filter((n) => !Number.isNaN(n)) : []);
		const label = document.createElement("b");
		if (kind === "grid") {
			const cols = px(cs.gridTemplateColumns);
			const rows = px(cs.gridTemplateRows);
			const cg = parseFloat(cs.columnGap) || 0;
			const rg = parseFloat(cs.rowGap) || 0;
			label.textContent = `grid ${cols.length}×${rows.length}`;
			let x = 0;
			cols.forEach((w, i) => {
				for (const at of i ? [x, x + w] : [0, w]) box.insertAdjacentHTML("beforeend", `<i class="v" style="left:${Math.min(bw - 1, at)}px"></i>`);
				x += w + cg;
			});
			let y = 0;
			rows.forEach((h) => {
				for (const at of [y, y + h]) box.insertAdjacentHTML("beforeend", `<i class="h" style="top:${Math.min(bh - 1, at)}px"></i>`);
				y += h + rg;
			});
		} else {
			const row = !cs.flexDirection.startsWith("column");
			label.className = "f";
			label.textContent = `flex ${row ? "→" : "↓"}`;
			box.insertAdjacentHTML("beforeend", row ? '<i class="f" style="top:50%"></i>' : '<i class="fv" style="left:50%"></i>');
		}
		box.append(label);
		el.append(box);
		extras.push(() => box.remove());
	}

	function setAngles() {
		page.style.setProperty("--rx", `${(base.rx + nudge.y).toFixed(2)}deg`);
		page.style.setProperty("--rz", `${(base.rz + nudge.x).toFixed(2)}deg`);
	}

	function describe(el) {
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		const cls = [...el.classList].filter((c) => !c.startsWith("xr-")).map((c) => `.${c}`).join("");
		const z = cs.zIndex === "auto" ? "" : ` z:${cs.zIndex}`;
		return `<b>${el.tagName.toLowerCase()}</b>${cls ? `<em>${cls}</em>` : ""}<br>${Math.round(el.offsetWidth)}×${Math.round(el.offsetHeight)} <span>depth ${el.style.getPropertyValue("--xd")}</span><br><span>display:${cs.display} · pos:${cs.position}${z}</span><br><span>font:${cs.fontSize}/${cs.fontWeight} · margin:${cs.marginTop} pad:${cs.paddingTop}</span>${el.classList.contains("xr-sc") ? "<br><em>creates a stacking context</em>" : ""}${r.width ? "" : ""}`;
	}

	function onMove(e) {
		if (!active) return;
		pending = e;
		raf ||= requestAnimationFrame(() => {
			raf = 0;
			const ev = pending;
			const el = ev.target instanceof Element ? ev.target.closest("[data-xr]") : null;
			if (el !== hovered) {
				hovered?.classList.remove("xr-hover");
				hovered = el;
				el?.classList.add("xr-hover");
			}
			if (el) {
				tip.innerHTML = describe(el);
				tip.hidden = false;
				const x = Math.min(innerWidth - tip.offsetWidth - 12, ev.clientX + 16);
				const y = Math.min(innerHeight - tip.offsetHeight - 12, ev.clientY + 18);
				tip.style.transform = `translate(${x}px,${y}px)`;
			} else tip.hidden = true;
			if (!reduced && !dragging) {
				nudge = { x: (ev.clientX / innerWidth - 0.5) * 8, y: (ev.clientY / innerHeight - 0.5) * -6 };
				setAngles();
			}
		});
	}
	let pending;
	let dragging = null;

	function onDown(e) {
		if (!active || e.button !== 0) return;
		const t = e.target;
		if (t instanceof Element && (t.closest("[data-xr]") || t.closest(".xr-panel, .dx-chip"))) return;
		dragging = { x: e.clientX, y: e.clientY, rx: base.rx, rz: base.rz };
		root.classList.add("is-dragging");
		root.setPointerCapture?.(e.pointerId);
	}
	function onDrag(e) {
		if (!dragging) return;
		base.rz = dragging.rz + (e.clientX - dragging.x) * 0.25;
		base.rx = Math.max(0, Math.min(85, dragging.rx - (e.clientY - dragging.y) * 0.2));
		setAngles();
	}
	function onUp() {
		dragging = null;
		root.classList.remove("is-dragging");
	}

	function buildPanel(stats) {
		panel = document.createElement("div");
		panel.className = "xr-panel";
		panel.innerHTML = `<h3>X-RAY <button type="button">Esc ✕</button></h3>
<div class="xr-legend"></div><div class="xr-scale"><span>shallow</span><span>depth</span><span>deep</span></div>
<dl><dt>boxes</dt><dd>${stats.boxes}</dd><dt>max depth</dt><dd>${stats.depth}</dd><dt>grid / flex</dt><dd>${stats.grid} / ${stats.flex}</dd><dt>stacking ctx</dt><dd>${stats.sc}</dd></dl>
<label>spacing<input type="range" min="0" max="90" value="26" aria-label="Layer spacing"></label>
<small>Hover to inspect · drag the backdrop to orbit · scroll still works</small>`;
		panel.querySelector("input").addEventListener("input", (e) => page.style.setProperty("--gap", `${e.target.value}px`));
		panel.querySelector("button").addEventListener("click", () => api.exit());
		tip = document.createElement("div");
		tip.className = "xr-tip";
		tip.hidden = true;
		root.append(panel, tip);
	}

	function clean() {
		for (const el of tagged) {
			el.removeAttribute("data-xr");
			el.style.removeProperty("--xd");
			el.classList.remove("xr-sc", "xr-hover");
		}
		tagged = [];
		extras.forEach((f) => f());
		extras = [];
		page.style.removeProperty("--rx");
		page.style.removeProperty("--rz");
		page.style.removeProperty("--gap");
		panel?.remove();
		tip?.remove();
		root.classList.remove("xr-on", "is-dragging");
	}

	const api = {
		enter() {
			clearTimeout(leaveTimer);
			if (active) return;
			active = true;
			const stats = collect();
			buildPanel(stats);
			base = { rx: 52, rz: -26 };
			nudge = { x: 0, y: 0 };
			// Commit the flat state first so the explode transitions in.
			void page.offsetWidth;
			root.classList.add("xr-on");
			root.addEventListener("pointermove", onMove);
			root.addEventListener("pointerdown", onDown);
			root.addEventListener("pointermove", onDrag);
			root.addEventListener("pointerup", onUp);
		},
		exit() {
			if (!active) return;
			active = false;
			root.removeEventListener("pointermove", onMove);
			root.removeEventListener("pointerdown", onDown);
			root.removeEventListener("pointermove", onDrag);
			root.removeEventListener("pointerup", onUp);
			panel?.remove();
			tip?.remove();
			root.classList.remove("xr-on");
			leaveTimer = setTimeout(clean, reduced ? 0 : 1500);
			onExit();
		},
		destroy() {
			clearTimeout(leaveTimer);
			cancelAnimationFrame(raf);
			active = false;
			clean();
		},
	};
	return api;
}
