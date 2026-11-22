export function activate({ root }) {
	for (const item of root.querySelectorAll(".site-project")) {
		const label = document.createElement("div");
		label.className = "acc-label";
		label.append(...item.childNodes);
		item.append(label);
	}

	const talks = root.querySelector(".site-talks .site-list");
	if (!talks) {
		return;
	}

	for (const item of talks.children) {
		const meta = item.querySelector(".site-item-meta");
		const time = meta?.querySelector("time");
		const loc = document.createElement("span");
		loc.className = "log-loc";
		const rest = (meta?.textContent ?? "").replace(time?.textContent ?? "", "").replace(/^\s*·\s*/, "").trim();
		loc.textContent = rest || "—";
		const date = document.createElement("span");
		date.className = "log-date";
		date.textContent = time?.textContent ?? "n.d.";
		meta.replaceChildren();
		meta.append(date, loc);
	}

	const head = document.createElement("li");
	head.className = "log-head";
	head.setAttribute("aria-hidden", "true");
	head.innerHTML = "<span>Date</span><span>Specimen / talk</span><span>Collection</span><span>Locality</span>";
	talks.prepend(head);
}
