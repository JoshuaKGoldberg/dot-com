const pad = (n) => String(n).padStart(2, "0");

function accession(text, fallbackYear, index) {
	const d = new Date(text);
	if (Number.isNaN(d.getTime())) return `${fallbackYear}.${pad(index + 1)}`;
	const hasDay = /\d{1,2},/.test(text);
	return hasDay ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : `${d.getFullYear()}.${pad(d.getMonth() + 1)}`;
}

export function activate({ root }) {
	const add = (item, { tag, medium, dim, acc }) => {
		const title = item.querySelector(".site-item-title");
		const wrap = document.createElement("div");
		wrap.className = "wl-title";
		title.replaceWith(wrap);
		wrap.append(title);
		const tagEl = Object.assign(document.createElement("div"), { className: "wl-tag", textContent: tag });
		const m = Object.assign(document.createElement("span"), { className: "wl-medium", textContent: medium });
		const d = Object.assign(document.createElement("span"), { className: "wl-dim", textContent: dim });
		const a = Object.assign(document.createElement("div"), { className: "wl-acc", textContent: `Acc. ${acc}` });
		item.prepend(tagEl);
		wrap.after(m, d);
		item.append(a);
	};

	root.querySelectorAll(".site-posts .site-item").forEach((item, i) => {
		const time = item.querySelector("time").textContent;
		const mins = item.querySelector(".site-item-minutes").textContent.match(/\d+/)[0];
		add(item, {
			tag: i < 2 ? "On view" : "In storage",
			medium: `Essay, ${new Date(time).getFullYear()}`,
			dim: `${mins} min · approx. ${Number(mins) * 230} words`,
			acc: accession(time, 2025, i),
		});
	});

	root.querySelectorAll(".site-projects .site-item").forEach((item, i) => {
		const meta = item.querySelector(".site-item-meta").textContent;
		const stars = meta.match(/★ (\S+)/);
		add(item, {
			tag: "Permanent collection",
			medium: "TypeScript, open source",
			dim: stars ? `${stars[1]} stars · MIT licensed` : "Ongoing · dimensions variable",
			acc: `2019.${pad(i + 1)}.01`,
		});
	});

	root.querySelectorAll(".site-talks .site-item").forEach((item, i) => {
		const time = item.querySelector("time");
		const meta = item.querySelector(".site-item-meta").textContent;
		const podcast = /Podcast/.test(meta);
		add(item, {
			tag: podcast ? "On air" : "On loan",
			medium: podcast ? "Conversation, audio" : `Talk, ${[30, 25, 40][i % 3]} min`,
			dim: podcast ? "Duration variable" : `Live, ${meta.split("·")[1]?.trim() ?? "touring"}`,
			acc: time ? accession(time.textContent, 2023, i) : `2023.${pad(i + 1)}`,
		});
	});

	// portrait gets a caption card too
	const portrait = root.querySelector(".site-portrait");
	const cap = document.createElement("div");
	cap.className = "wl-portrait-label";
	cap.innerHTML = "<b>Josh Goldberg</b><span><i>Half-smiling, with fleece</i></span><span>Photograph, 2026</span><span>Acc. 2026.08.10</span>";
	portrait.after(cap);
	const hero = root.querySelector(".site-hero");
	hero.classList.add("wl-hero");
	cap.remove();
	portrait.closest(".site-hero").querySelector(".site-hero-text").append(cap);
}
