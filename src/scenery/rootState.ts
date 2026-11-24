import { Emitter, type Listener } from "./Emitter";

const changes = new Emitter();

export const rootState = readRootState();

export function onPause(listener: Listener, signal?: AbortSignal) {
	onRootState(() => {
		if (!rootState.isPlaying) {
			listener();
		}
	}, signal);
}

export function onRootState(listener: Listener, signal?: AbortSignal) {
	changes.listen(listener, signal);
}

function readRootState() {
	const { classList, dataset } = document.documentElement;

	return {
		isDark: classList.contains("dark"),
		isPlaying: dataset.motion === "playing",
	};
}

new MutationObserver(() => {
	const { isDark, isPlaying } = readRootState();

	if (isDark !== rootState.isDark || isPlaying !== rootState.isPlaying) {
		rootState.isDark = isDark;
		rootState.isPlaying = isPlaying;
		changes.emit();
	}
}).observe(document.documentElement, {
	attributeFilter: ["class", "data-motion"],
});
