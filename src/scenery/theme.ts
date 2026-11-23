import { fadeMilliseconds } from "~/theme/fadeTheme";

import { Emitter, type Listener } from "./Emitter";
import { createFrameTask } from "./frameLoop";
import { moveToward } from "./math";
import { onRootState, rootState } from "./rootState";

const changes = new Emitter();

/** The page's color theme, which changes gradually. */
export const theme = {
	/** How far it is from light to dark, from 0 to 1. */
	darkness: Number(rootState.isDark),
};

/** Calls back each time the theme has changed, including while it's changing. */
export function onTheme(listener: Listener, signal: AbortSignal) {
	changes.listen(listener, signal);
}

const fading = createFrameTask(
	(seconds) => {
		const { themeFading } = document.documentElement.dataset;

		theme.darkness = moveToward(
			theme.darkness,
			Number(rootState.isDark),
			(seconds * 1000) / fadeMilliseconds,
		);
		changes.emit();

		// Styles that are read from the page may finish changing a little later
		return (
			themeFading !== undefined || theme.darkness !== Number(rootState.isDark)
		);
	},
	{ isSmooth: true, signal: new AbortController().signal },
);

onRootState(() => {
	if (theme.darkness === Number(rootState.isDark)) {
		return;
	}

	if (rootState.isPlaying) {
		fading.wake();
	} else {
		theme.darkness = Number(rootState.isDark);
		changes.emit();
	}
});
