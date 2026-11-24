import { onCleanup, onMount } from "solid-js";

import type { VideoSize } from "./readVideoSize";

export interface LoopedVideoProps {
	alt: string;
	size: VideoSize;
	src: string;
}

export function LoopedVideo(props: LoopedVideoProps) {
	let video!: HTMLVideoElement;

	onMount(() => {
		const controller = new AbortController();

		onCleanup(() => {
			controller.abort();
		});

		void followMotion(video, controller.signal);
	});

	return (
		<video
			aria-label={props.alt}
			height={props.size.height}
			loop
			muted
			playsinline
			preload="none"
			ref={video}
			src={props.src}
			style={{ height: "auto", "max-width": "100%" }}
			width={props.size.width}
		/>
	);
}

async function followMotion(video: HTMLVideoElement, signal: AbortSignal) {
	// Reads from the document, so it can't be imported on the server
	const root = await import("~/scenery/rootState");
	let isOnScreen = false;

	if (signal.aborted) {
		return;
	}

	let wasPlaying = root.rootState.isPlaying;

	const update = () => {
		const { isPlaying } = root.rootState;

		video.controls = !isPlaying;
		video.preload = isPlaying ? "none" : "metadata";

		if (isPlaying && isOnScreen) {
			// Rejects if it's paused again before it's loaded enough to start
			video.play().catch(() => undefined);
		} else {
			video.pause();
		}
	};

	const observer = new IntersectionObserver((entries) => {
		isOnScreen = entries[entries.length - 1].isIntersecting;
		update();
	});

	observer.observe(video);
	root.onRootState(() => {
		if (root.rootState.isPlaying !== wasPlaying) {
			wasPlaying = root.rootState.isPlaying;
			update();
		}
	}, signal);
	signal.addEventListener("abort", () => {
		observer.disconnect();
	});
}
