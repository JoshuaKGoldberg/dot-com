import { BlogShare } from "./BlogShare";
import styles from "./BlogShareBottom.module.css";

export interface BlogShareBottomProps {
	description: string;
	title: string;
	url: URL;
}

export function BlogShareBottom(props: BlogShareBottomProps) {
	return (
		<>
			<hr />
			<BlogShare {...props} class={styles.blogShare}>
				Liked this post? Thanks! Let the world know:
			</BlogShare>
		</>
	);
}
