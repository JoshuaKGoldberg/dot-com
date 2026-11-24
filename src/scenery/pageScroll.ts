import { Emitter, type Listener } from "./Emitter";

const scrolls = new Emitter();

let scrollTop: number | undefined;

/** How far the page has scrolled, without needing to measure layout each time. */
export const pageScroll = {
	get top() {
		return (scrollTop ??= scrollY);
	},
};

export function onPageScroll(listener: Listener, signal: AbortSignal) {
	scrolls.listen(listener, signal);
}

function update() {
	scrollTop = undefined;
	scrolls.emit();
}

addEventListener("scroll", update, { passive: true });
document.addEventListener("astro:after-swap", update);
