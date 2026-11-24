import { onPause, rootState } from "./rootState";

/** @returns Whether there's anything left to do next frame. */
export type FrameStep = (seconds: number) => boolean;

export interface FrameTaskOptions {
	/** Whether to run as often as the screen refreshes, rather than at the usual rate. */
	isSmooth?: boolean;

	signal?: AbortSignal;
}

interface RunningTask {
	isSmooth: boolean;
	ranAt: number | undefined;
	step: FrameStep;
}

/** Everything's slow and soft, so there's no benefit in using any more power than this. */
const millisecondsPerStep = 1000 / 30;

/** Roughly a screen refresh, for steps that don't know how long it's been. */
const defaultElapsed = 16;

/** Longest time a step may represent, such as after being in the background. */
const maximumElapsed = 100;

/** How early a step may run, as screen refreshes don't line up exactly with steps. */
const tolerance = 4;

const running = new Set<RunningTask>();

let frame: number | undefined;
let nextStepAt = 0;

/**
 * Creates a task on the single loop shared by all scenery.
 * The loop only runs while any task is awake, with all tasks' steps in unison.
 * @returns Wakes the task, unless motion is paused.
 */
export function createFrameTask(
	step: FrameStep,
	{ isSmooth = false, signal }: FrameTaskOptions = {},
) {
	const task: RunningTask = { isSmooth, ranAt: undefined, step };

	signal?.addEventListener("abort", () => {
		running.delete(task);
	});

	return () => {
		if (rootState.isPlaying && !signal?.aborted && !running.has(task)) {
			task.ranAt = undefined;
			running.add(task);
			schedule();
		}
	};
}

function runFrame(now: number) {
	const isStep = nextStepAt - now <= tolerance;

	frame = undefined;

	if (isStep) {
		nextStepAt = now + millisecondsPerStep;
	}

	for (const task of running) {
		if (isStep || task.isSmooth) {
			runTask(task, now);
		}
	}

	schedule();
}

function runTask(task: RunningTask, now: number) {
	const elapsed = task.ranAt === undefined ? defaultElapsed : now - task.ranAt;

	task.ranAt = now;

	try {
		if (!task.step(Math.min(elapsed, maximumElapsed) / 1000)) {
			running.delete(task);
		}
	} catch (error) {
		// One task failing shouldn't keep the rest from running
		running.delete(task);
		reportError(error);
	}
}

function schedule() {
	if (running.size) {
		frame ??= requestAnimationFrame(runFrame);
	}
}

onPause(() => {
	running.clear();
});
