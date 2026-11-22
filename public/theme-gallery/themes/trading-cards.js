function el(tag, className, html) {
	const node = document.createElement(tag);
	if (className) {
		node.className = className;
	}
	if (html !== undefined) {
		node.innerHTML = html;
	}
	return node;
}

function escape(text) {
	return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

function wrap(item, art) {
	const body = el("div", "tc-body");
	body.append(...item.childNodes);
	const card = el("div", "tc");
	if (art) {
		card.append(art);
	}
	card.append(body);
	item.append(card);
	item.classList.add("tc-sleeve");
	return body;
}

export function activate({ root, reducedMotion }) {
	root.querySelectorAll(".site-project").forEach((item, index) => {
		const meta = item.querySelector(".site-item-meta");
		const [language = "", extra = ""] = meta.textContent.split("·").map((part) => part.trim());
		const stats = el("dl", "stats");
		const star = extra.startsWith("★");
		stats.innerHTML = `<div><dt>Language</dt><dd>${escape(language)}</dd></div><div><dt>${star ? "Stars" : "Status"}</dt><dd>${escape(star ? extra.replace("★", "").trim() : extra)}</dd></div>`;
		meta.replaceWith(stats);
		const art = el("div", "art", `<b>${String(index + 1).padStart(3, "0")}</b><small>Project</small>`);
		wrap(item, art);
	});

	for (const item of root.querySelectorAll(".site-post")) {
		const time = item.querySelector("time")?.textContent ?? "";
		const [month = "", day = "", year = ""] = time.replace(",", "").split(" ");
		const art = el("div", "art", `<small>${escape(month)}</small><b>${escape(day)}</b><small>${escape(year)}</small>`);
		wrap(item, art);
	}

	for (const item of root.querySelectorAll(".site-talk")) {
		const time = item.querySelector("time")?.textContent ?? "";
		const meta = item.querySelector(".site-item-meta");
		meta.textContent = time ? meta.textContent.replace(time, "").replace(/^\s*·\s*/, "") : "Podcast episode";
		const parts = time.replace(",", "").split(" ");
		const stub = parts.length === 3
			? el("div", "stub", `<small>${escape(parts[0])}</small><b>${escape(parts[1])}</b><small>${escape(parts[2])}</small>`)
			: parts[0]
				? el("div", "stub", `<small>${escape(parts[0])}</small><b>${escape(parts[1] ?? "")}</b>`)
				: el("div", "stub", `<small>Admit</small><b>ONE</b><small>Audio</small>`);
		const body = wrap(item);
		item.querySelector(".tc").append(stub);
		void body;
	}

	const portrait = root.querySelector(".site-portrait");
	portrait?.classList.add("tc-sleeve");

	if (reducedMotion) {
		return;
	}

	function onMove(event) {
		const sleeve = event.target.closest?.(".tc-sleeve");
		if (!sleeve || !root.contains(sleeve)) {
			return;
		}
		const rect = sleeve.getBoundingClientRect();
		const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
		const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
		sleeve.style.setProperty("--mx", `${x.toFixed(1)}%`);
		sleeve.style.setProperty("--my", `${y.toFixed(1)}%`);
		sleeve.style.setProperty("--mxn", x.toFixed(1));
	}

	root.addEventListener("pointermove", onMove, { passive: true });
	return () => root.removeEventListener("pointermove", onMove);
}
