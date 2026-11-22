// _vs3/credit.js: five treatments for the footer credit ("Made with 💙 in Boston / using Astro, Solid, and TypeScript. / view source").
// Same words and the same link in each; the DOM is regrouped and a class picks the layout (see base.css).
const mk = (cls, ...kids) => { const d = document.createElement("div"); d.className = cls; d.append(...kids); return d; };

export function vsCredit(root, kind) {
	const footer = root.querySelector(".site-footer");
	const p = footer?.querySelector(":scope > p"), link = footer?.querySelector(":scope > a");
	if (!footer || !p || !link) return () => {};
	footer.classList.add("vs-cr-" + kind);
	const dot = () => { const s = document.createElement("span"); s.className = "vs-dot"; s.setAttribute("aria-hidden", "true"); s.textContent = " · "; return s; };
	const added = [];
	if (kind === "horizon" || kind === "fog" || kind === "chart") {
		const wrap = mk("vs-credit vs-credit-" + kind);
		const br = p.querySelector("br");
		if (br && kind !== "chart") br.replaceWith(document.createTextNode(" ")); // "in Boston using Astro…"
		wrap.append(p);
		if (kind !== "chart") { const d = dot(); d.classList.add("vs-dot-link"); wrap.append(d); } // the gap before "view source" is 1.5x wider
		wrap.append(link);
		footer.append(wrap); added.push(wrap);
		if (kind === "horizon") {
			// a faint, flipped, compressed copy on the lake; purely decorative
			const refl = wrap.cloneNode(true);
			refl.className = "vs-credit vs-credit-refl";
			refl.setAttribute("aria-hidden", "true");
			refl.setAttribute("inert", "");
			refl.querySelectorAll("a").forEach((a) => { a.removeAttribute("href"); a.tabIndex = -1; });
			footer.append(refl); added.push(refl);
		}
		if (kind === "chart") {
			const mark = document.createElement("span"); mark.className = "vs-mark"; mark.setAttribute("aria-hidden", "true"); mark.textContent = "✦";
			wrap.prepend(mark);
		}
	} else if (kind === "column") {
		const wrap = mk("vs-credit vs-credit-column");
		const br = p.querySelector("br");
		if (br) br.replaceWith(document.createTextNode(" "));
		wrap.append(p, link);
		footer.append(wrap); added.push(wrap);
	} else if (kind === "legend") {
		// split: place credit bottom-left, stack credit bottom-right
		const left = mk("vs-credit vs-credit-legend vs-l");
		const right = mk("vs-credit vs-credit-legend vs-r");
		const lp = document.createElement("p"); lp.innerHTML = p.innerHTML.split("<br>")[0];
		const rp = document.createElement("p"); rp.append("Astro · Solid · TypeScript");
		left.append(lp);
		right.append(rp, dot(), link);
		right.setAttribute("title", "using Astro, Solid, and TypeScript.");
		footer.append(left, right); added.push(left, right);
		p.classList.add("vs-sr"); // the full sentence stays in the DOM for screen readers
		footer.append(p);
	}
	p.classList.add("vs-src");
	return () => { for (const a of added) a.remove(); footer.classList.remove("vs-cr-" + kind); };
}
