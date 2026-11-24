import type { APIRoute, GetStaticPaths } from "astro";

import { getCollection } from "astro:content";

import {
	createBlogDescription,
	createBlogTitle,
} from "~/components/blog/utils";
import {
	blogDescription,
	homeTagline,
	projectsDescription,
	siteName,
	speakingDescription,
} from "~/constants";
import { type PortraitName, portraits } from "~/portraits";
import { drawPortrait, type Picture } from "~/previews/drawPicture";
import { drawPreview } from "~/previews/drawPreview";
import { getPostPicture } from "~/previews/getPostPicture";

interface Props {
	drawPicture: () => Promise<Picture>;
	subtitle: string;
	title: string;
}

const pages: Record<PortraitName, { subtitle: string; title: string }> = {
	blog: { subtitle: blogDescription, title: "Goldblog" },
	home: { subtitle: homeTagline, title: siteName },
	projects: { subtitle: projectsDescription, title: "Projects" },
	speaking: { subtitle: speakingDescription, title: "Speaking" },
};

export const getStaticPaths = (async () => {
	const posts = await getCollection("blog");

	return [
		...Object.entries(portraits).map(([name, portrait]) => ({
			params: { name },
			props: {
				...pages[name as PortraitName],
				drawPicture: () => drawPortrait(portrait),
			} satisfies Props,
		})),
		...posts.map((post) => ({
			params: { name: `blog/${post.id}` },
			props: {
				drawPicture: getPostPicture(post).draw,
				subtitle: createBlogDescription(post),
				title: createBlogTitle(post),
			} satisfies Props,
		})),
	];
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = async ({
	props: { drawPicture, subtitle, title },
}) => {
	const preview = await drawPreview({
		picture: await drawPicture(),
		subtitle,
		title,
	});

	return new Response(new Uint8Array(preview), {
		headers: { "Content-Type": "image/jpeg" },
	});
};
