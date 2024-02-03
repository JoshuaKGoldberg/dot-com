export interface LoopedVideoProps {
	src: string;
	title: string;
}

export function LoopedVideo(props: LoopedVideoProps) {
	return (
		<video
			autoplay
			muted
			ref={(element) => {
				const media = window.matchMedia("(prefers-reduced-motion: reduce)");

				function setLoop() {
					element.loop = !media.matches;

					if (!media.matches) {
						void element.play();
					}
				}

				media.addEventListener("change", setLoop);
				setLoop();
			}}
			title={props.title}
		>
			<source src={props.src} type="video/webm" />
		</video>
	);
}
