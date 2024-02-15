import clsx from "clsx";
import { For, JSX } from "solid-js";

import { SocialImage } from "../SocialImage";
import styles from "./BlogShare.module.css";

export interface BlogShareProps {
	children?: JSX.Element;
	class?: string;
	description: string;
	title: string;
	url: URL;
}

export function BlogShare(props: BlogShareProps) {
	return (
		<span class={clsx(styles.shares, props.class)}>
			{props.children}
			<For
				each={[
					[
						"LinkedIn",
						`https://linkedin.com/sharing/share-offsite/?url=${props.url.toString()}`,
						"/icons/linkedin.svg",
					],
					[
						"Twitter",
						`https://twitter.com/intent/tweet?text=${[
							`📝 ${props.title}`,
							`"${props.description}" - by @JoshuaKGoldberg`,
							"",
						].join("%0a%0a")}&url=${props.url.toString()}`,
						"/icons/twitter.svg",
					],
				]}
			>
				{([network, href, src]) => (
					<a
						class="share"
						href={href}
						target="_blank"
						title={`Share on ${network}`}
					>
						<SocialImage alt={`${network} logo`} src={src} />
					</a>
				)}
			</For>
		</span>
	);
}
