export const bookTitle = "Learning TypeScript";

export const blogDescription =
	"A blog about open source, static analysis, and web dev.";

export const homeTagline = "I’m good at TypeScript.";

export const projectsDescription =
	"I work primarily on open source tooling for TypeScript projects.";

export const speakingDescription =
	"I talk about static analysis, accessibility, and team culture.";

export const site = "https://www.joshuakgoldberg.com";

/** Feed readers know posts by their URLs, so those need to never change. */
export const feedSite = "https://joshuakgoldberg.com";

export const siteName = "Josh Goldberg";

export const colorsBackground = { dark: "#0b1220", light: "#ecf4f9" };

const branch = process.env.WORKERS_CI_BRANCH;

/** Where images for links are, which for branches' previews isn't the site yet. */
export const imageOrigin =
	branch && branch !== "main"
		? `https://${branch.replaceAll(/[^a-z\d]+/gi, "-").toLowerCase()}-dot-com.dot-com.workers.dev`
		: site;
