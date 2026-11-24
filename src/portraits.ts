import type { ImageMetadata } from "astro";

import blogHalo from "~/assets/heroes/blog-halo.webp";
import blogScene from "~/assets/heroes/blog-scene.webp";
import blog from "~/assets/heroes/blog.webp";
import homeHalo from "~/assets/heroes/home-halo.webp";
import home from "~/assets/heroes/home.webp";
import projectsHalo from "~/assets/heroes/projects-halo.webp";
import projectsScene from "~/assets/heroes/projects-scene.webp";
import projects from "~/assets/heroes/projects.webp";
import speakingHalo from "~/assets/heroes/speaking-halo.webp";
import speakingScene from "~/assets/heroes/speaking-scene.webp";
import speaking from "~/assets/heroes/speaking.webp";

export interface Portrait {
	alt: string;

	/** Blurred silhouette of the cutout, used only for its alpha. */
	halo: ImageMetadata;

	/** Person cut out from their photo, with extra pixels below the circle, and maybe above it. */
	image: ImageMetadata;

	isSceneFaint?: boolean;

	/** What's behind them in their photo, for the same area as the circle. */
	scene?: ImageMetadata;
}

export type PortraitName = "blog" | "home" | "projects" | "speaking";

export const portraits: Record<PortraitName, Portrait> = {
	blog: {
		alt: "Josh mid-sentence on stage under green lights, wearing a headset microphone and a light patterned shirt",
		halo: blogHalo,
		image: blog,
		scene: blogScene,
	},
	home: {
		alt: "Josh looking calmly at the camera from inside a purple hood with big ears and a triangular antenna",
		halo: homeHalo,
		image: home,
	},
	projects: {
		alt: "Josh smiling warmly in a grey zip-up fleece",
		halo: projectsHalo,
		image: projects,
		isSceneFaint: true,
		scene: projectsScene,
	},
	speaking: {
		alt: "Josh speaking excitedly into a microphone while wearing a shiny silver space suit",
		halo: speakingHalo,
		image: speaking,
		scene: speakingScene,
	},
};

/** Height over width of a cutout that starts at the top of its circle. */
const usualRatio = 544 / 512;

/** @returns How far above its circle a cutout reaches, relative to its width. */
export function getOverhang({ height, width }: ImageMetadata) {
	return height / width - usualRatio;
}
