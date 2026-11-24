import type { APIRoute, GetStaticPaths, ImageMetadata } from "astro";

import { getCollection } from "astro:content";

import blogScene from "~/assets/heroes/blog-scene.webp";
import blog from "~/assets/heroes/blog.webp";
import home from "~/assets/heroes/home.webp";
import projectsScene from "~/assets/heroes/projects-scene.webp";
import projects from "~/assets/heroes/projects.webp";
import speakingScene from "~/assets/heroes/speaking-scene.webp";
import speaking from "~/assets/heroes/speaking.webp";
import {
	createBlogDescription,
	createBlogTitle,
} from "~/components/blog/utils";
import {
	blogDescription,
	homeTagline,
	projectsDescription,
	speakingDescription,
} from "~/constants";
import { drawPortrait, drawThumbnail } from "~/previews/drawPicture";
import { drawPreview } from "~/previews/drawPreview";

interface Props {
	portrait?: [ImageMetadata, ImageMetadata?];
	subtitle: string;
	thumbnail?: ImageMetadata;
	title: string;
}

const signature = "joshuakgoldberg.com";

export const getStaticPaths = (async () => {
	const posts = await getCollection("blog");

	return [
		{
			params: { name: "home" },
			props: {
				portrait: [home],
				subtitle: homeTagline,
				title: "Josh Goldberg",
			},
		},
		{
			params: { name: "goldblog" },
			props: {
				portrait: [blog, blogScene],
				subtitle: blogDescription,
				title: "Goldblog",
			},
		},
		{
			params: { name: "projects" },
			props: {
				portrait: [projects, projectsScene],
				subtitle: projectsDescription,
				title: "Projects",
			},
		},
		{
			params: { name: "speaking" },
			props: {
				portrait: [speaking, speakingScene],
				subtitle: speakingDescription,
				title: "Speaking",
			},
		},
		...posts.map((post) => ({
			params: { name: `blog/${post.id}` },
			props: {
				subtitle: createBlogDescription(post),
				thumbnail: post.data.thumbnail ?? post.data.image.src,
				title: createBlogTitle(post),
			},
		})),
	];
}) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = async ({
	props: { portrait, subtitle, thumbnail, title },
}) => {
	const picture = portrait
		? await drawPortrait(...portrait)
		: thumbnail && (await drawThumbnail(thumbnail));

	if (!picture) {
		return new Response(null, { status: 404 });
	}

	return new Response(
		new Uint8Array(await drawPreview({ picture, signature, subtitle, title })),
		{ headers: { "Content-Type": "image/jpeg" } },
	);
};
