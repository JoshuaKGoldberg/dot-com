export interface RootState {
	isDark: boolean;
	isPlaying: boolean;
}

/** The page's color theme and motion preference, as set on the root element. */
export let rootState = readRootState();

const listeners = new Set<() => void>();

/** Calls back each time the root state changes. */
export function watchRootState(listener: () => void) {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
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
		next.isDark === rootState.isDark &&
		next.isPlaying === rootState.isPlaying
	) {
		return;
	}

	rootState = next;

	for (const listener of listeners) {
		listener();
	}
}).observe(document.documentElement, {
	attributeFilter: ["class", "data-motion"],
});
