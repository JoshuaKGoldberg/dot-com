import { site } from "~/constants";

const branch = process.env.WORKERS_CI_BRANCH;

/** Branches' deployments have their own images, which the site doesn't have yet. */
export const imageOrigin =
	branch && branch !== "main"
		? `https://${branch.replaceAll(/[^a-z\d]+/gi, "-").toLowerCase()}-dot-com.dot-com.workers.dev`
		: site;
