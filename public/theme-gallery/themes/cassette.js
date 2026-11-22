export function activate({ root }) {
	for (const item of root.querySelectorAll(".site-posts .site-item")) {
		const text = item.querySelector(".site-item-minutes")?.textContent ?? "";
		const minutes = Number.parseInt(text, 10);
		if (!Number.isFinite(minutes)) continue;
		const time = document.createElement("span");
		time.className = "trk-time";
		time.textContent = `${minutes}:00`;
		time.setAttribute("aria-label", `${minutes} minute read`);
		item.append(time);
	}
	return () => {};
}
