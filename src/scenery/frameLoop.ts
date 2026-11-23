import { onPause, rootState } from "./rootState";

/**
 * Advances something by a frame.
 * @returns Whether there's anything left to do next frame.
 */
export type FrameStep = (seconds: number) => boolean;

export interface FrameTask {
	/** Stops running until the next wake. */
	sleep: () => void;

	/** Runs repeatedly until the step reports it has nothing left to do. */
	wake: () => void;
}

export interface FrameTaskOptions {
	/** Whether to run as often as the screen refreshes, rather than at the usual rate. */
	isSmooth?: boolean;

	/** Stops the task for good once aborted. */
	signal: AbortSignal;
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
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Creates a task on the single loop shared by all scenery.
 * The loop only runs while any task is awake, with all tasks' steps in unison.
 * Nothing wakes while motion is paused.
 */
export function createFrameTask(
	step: FrameStep,
	{ isSmooth = false, signal }: FrameTaskOptions,
): FrameTask {
	const task: RunningTask = { isSmooth, ranAt: undefined, step };
	const sleep = () => {
		running.delete(task);
	};

	signal.addEventListener("abort", sleep);

	return {
		sleep,
		wake() {
			if (rootState.isPlaying && !signal.aborted && !running.has(task)) {
				task.ranAt = undefined;
				running.add(task);
				schedule();
			}
		},
	};
}

function requestFrame() {
	clearTimeout(timer);
	timer = undefined;
	frame ??= requestAnimationFrame(runFrame);
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

/** Animation frames use power even if nothing happens in them, so most are skipped. */
function schedule() {
	if (frame !== undefined || !running.size) {
		return;
	}

	const wait = nextStepAt - performance.now() - defaultElapsed;

	if (wait <= 0 || [...running].some(({ isSmooth }) => isSmooth)) {
		requestFrame();
	} else {
		timer ??= setTimeout(requestFrame, wait);
	}
}

onPause(() => {
	running.clear();
});
