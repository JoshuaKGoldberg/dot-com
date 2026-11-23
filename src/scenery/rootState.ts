import { Emitter, type Listener } from "./Emitter";

export interface RootState {
	isDark: boolean;
	isPlaying: boolean;
}

const changes = new Emitter();

/** The page's color theme and motion preference, as set on the root element. */
export let rootState = readRootState();

/** Calls back each time motion is paused. */
export function onPause(listener: Listener, signal?: AbortSignal) {
	onRootState(() => {
		if (!rootState.isPlaying) {
			listener();
		}
	}, signal);
}

/** Calls back each time the root state changes. */
export function onRootState(listener: Listener, signal?: AbortSignal) {
	changes.listen(listener, signal);
}

function readRootState(): RootState {
	const { classList, dataset } = document.documentElement;

	return {
		isDark: classList.contains("dark"),
		isPlaying: dataset.motion === "playing",
	};
}

new MutationObserver(() => {
	// Navigating between pages briefly clears the root's attributes before the theme
	// and motion scripts restore them, and that isn't a change worth repainting for
	if (!document.documentElement.dataset.motion) {
		return;
	}

	const next = readRootState();

	if (
		next.isDark !== rootState.isDark ||
		next.isPlaying !== rootState.isPlaying
	) {
		rootState = next;
		changes.emit();
	}
}).observe(document.documentElement, {
	attributeFilter: ["class", "data-motion"],
});
