export interface LoopedVideoProps {
	size?: null | { height: number; width: number };
	src: string;
	title: string;
}

/** Only starts loading once it's hydrated, which is expected to be once it's visible. */
export function LoopedVideo(props: LoopedVideoProps) {
	return (
		<video
			height={props.size?.height}
			muted
			playsinline
			preload="none"
			ref={(element) => {
				const media = window.matchMedia("(prefers-reduced-motion: reduce)");

				function setLoop() {
					element.loop = !media.matches;

					if (media.matches) {
						element.preload = "auto";
					} else {
						void element.play();
					}
				}

				media.addEventListener("change", setLoop);
				setLoop();
			}}
			title={props.title}
			width={props.size?.width}
		>
			<source src={props.src} type="video/webm" />
		</video>
	);
}
