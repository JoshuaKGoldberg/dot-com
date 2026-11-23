import { Emitter, type Listener } from "./Emitter";

const scrolls = new Emitter();

let scrollTop: number | undefined;

/** How far the page has scrolled, without needing to measure layout each time. */
export const pageScroll = {
	get top() {
		return (scrollTop ??= document.body.scrollTop);
	},
};

export function onPageScroll(listener: Listener, signal: AbortSignal) {
	scrolls.listen(listener, signal);
}

// The body's what scrolls, but its events don't bubble and navigating replaces it
document.addEventListener(
	"scroll",
	({ target }) => {
		if (target === document.body) {
			scrollTop = undefined;
			scrolls.emit();
		}
	},
	{ capture: true, passive: true },
);

document.addEventListener("astro:after-swap", () => {
	scrollTop = undefined;
	scrolls.emit();
});
