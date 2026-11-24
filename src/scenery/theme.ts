import { fadeMilliseconds, maximumFadeMilliseconds } from "~/theme/fadeTheme";

import { Emitter, type Listener } from "./Emitter";
import { createFrameTask } from "./frameLoop";
import { moveToward, smoothstep } from "./math";
import { onRootState, rootState } from "./rootState";

const changes = new Emitter();

let progress = Number(rootState.isDark);

/** The page's color theme, which changes gradually. */
export const theme = {
	/** How far it is from light to dark, from 0 to 1. */
	get darkness() {
		return smoothstep(0, 1, progress);
	},
};

/** Includes each frame while the theme is changing. */
export function onTheme(listener: Listener, signal: AbortSignal) {
	changes.listen(listener, signal);
}

const wakeFading = createFrameTask(
	(seconds) => {
		const { themeFading } = document.documentElement.dataset;

		progress = moveToward(
			progress,
			Number(rootState.isDark),
			(seconds * 1000) / fadeMilliseconds,
		);
		changes.emit();

		// Styles that are read from the page may finish changing a little later
		return themeFading !== undefined || progress !== Number(rootState.isDark);
	},
	{ isSmooth: true },
);

onRootState(() => {
	if (progress === Number(rootState.isDark)) {
		return;
	}

	if (rootState.isPlaying) {
		wakeFading();
	} else {
		progress = Number(rootState.isDark);
		changes.emit();
		setTimeout(() => {
			changes.emit();
		}, maximumFadeMilliseconds);
	}
});
