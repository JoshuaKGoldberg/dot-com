export function activate({ root }) {
	const page = root.querySelector(".site-page");
	const header = root.querySelector(".site-header");
	const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
	const mast = document.createElement("div");
	mast.className = "bs-masthead";
	mast.innerHTML = `
		<div class="bs-ears">
			<div class="bs-ear bs-ear-left">Weather<b>TypeScript, sunny</b>No type errors expected</div>
			<h2 class="bs-title">The Goldberg Gazette</h2>
			<div class="bs-ear bs-ear-right">All the types<b>Fit to compile</b>Free · No paywall</div>
		</div>
		<div class="bs-dateline"><span>Boston</span><span>Est. 2014</span><span>${date}</span><span>Late Edition</span></div>`;
	page.insertBefore(mast, header);
}
