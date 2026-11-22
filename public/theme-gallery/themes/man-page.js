export function activate({ root }) {
	const page = root.querySelector(".site-page");
	const main = root.querySelector(".site-main");
	const hero = root.querySelector(".site-hero");
	const about = root.querySelector(".site-about");
	const footer = root.querySelector(".site-footer");
	const tagline = hero.querySelector(".site-tagline").textContent.trim().replace(/\.$/, "");
	const socials = [...hero.querySelectorAll(".site-socials a")];
	const portrait = hero.querySelector(".site-portrait");

	const el = (tag, cls, html) => {
		const node = document.createElement(tag);
		if (cls) node.className = cls;
		if (html !== undefined) node.innerHTML = html;
		return node;
	};
	const section = (title, ...kids) => {
		const sec = el("section", "mp-sec");
		sec.append(el("h2", "", title), ...kids);
		return sec;
	};

	root.querySelector(".site-logo").textContent = "man josh";
	const run = el("div", "mp-run", "<span>GOLDBERG(1)</span><span>User Commands</span><span>GOLDBERG(1)</span>");
	page.insertBefore(run, root.querySelector(".site-header"));
	// the header sits under the running header, like a pager status line

	const name = section("Name", el("p", "", `<b class="mp-flag">josh</b> - ${tagline.replace(/^I'm an? /, "")}`));
	const synopsis = section(
		"Synopsis",
		el(
			"p",
			"mp-synopsis",
			`<span class="mp-flag">josh</span> [<span class="mp-flag">--maintain</span> <span class="mp-arg">typescript-eslint</span>] [<span class="mp-flag">--write</span>] [<span class="mp-flag">--speak</span>]…`,
		),
	);
	const description = section("Description");
	description.append(about);
	about.classList.remove("site-about");
	about.classList.add("site-about");

	const sections = [...main.querySelectorAll(".site-section")];
	const talks = root.querySelector(".site-talks .site-section-title");
	if (talks) talks.textContent = "Talks";

	const see = el("div", "mp-see");
	const entries = [
		["typescript-eslint", "7"],
		["create-typescript-app", "1"],
		["learning-typescript", "3"],
		["flint", "1"],
		["squiggleconf", "7"],
	];
	entries.forEach(([n, sec], i) => {
		const a = el("a", "site-link", n);
		a.href = "#";
		const wrap = el("span", "", `(${sec})${i < entries.length - 1 ? "," : ""}`);
		const grp = el("span");
		grp.style.whiteSpace = "nowrap";
		grp.append(a, wrap);
		see.append(grp);
	});
	const seeSocial = el("div", "mp-see");
	socials.forEach((a, i) => {
		const grp = el("span");
		grp.style.whiteSpace = "nowrap";
		a.textContent = a.textContent.toLowerCase();
		grp.append(a, `(1)${i < socials.length - 1 ? "," : ""}`);
		seeSocial.append(grp);
	});
	const seeAlso = section("See also", see, seeSocial);

	const author = el("div", "mp-author");
	author.append(portrait, el("p", "", "Written by Josh Goldberg, who maintains too many things.<br>Report bugs to the issue tracker, as is tradition."));
	const authorSec = section("Author", author);

	const bugs = section("Colophon");
	footer.querySelectorAll("p, a").forEach((n) => bugs.append(n));

	main.replaceChildren(name, synopsis, description, ...sections, authorSec, seeAlso, bugs);
	footer.replaceWith(el("div", "mp-run mp-run-foot", "<span>dot-com 2026</span><span></span><span>GOLDBERG(1)</span>"));
}
