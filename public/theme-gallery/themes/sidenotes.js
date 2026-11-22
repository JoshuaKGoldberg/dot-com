export function activate({ root }) {
	let n = 0;
	const ref = (k) => {
		const sup = document.createElement("sup");
		sup.className = "sn-ref";
		sup.textContent = String(k);
		return sup;
	};

	const about = root.querySelector(".site-about");
	const aboutNotes = [
		"typescript-eslint has been downloaded more times than the author has had hot dinners. This is an unverified claim.",
		"Learning TypeScript is published by O’Reilly; the animal on the cover is not a type error.",
	];
	[...about.querySelectorAll("p")].forEach((p, i) => {
		n += 1;
		p.append(ref(n));
		const note = document.createElement("aside");
		note.className = "sn-about";
		note.dataset.n = String(n);
		note.textContent = aboutNotes[i] ?? "";
		p.after(note);
	});

	root.querySelectorAll(".site-item").forEach((item) => {
		n += 1;
		item.querySelector(".site-item-description").dataset.n = String(n);
		const title = item.querySelector(".site-item-title");
		const head = document.createElement("div");
		head.className = "sn-head";
		title.replaceWith(head);
		head.append(title, ref(n));
	});
}
