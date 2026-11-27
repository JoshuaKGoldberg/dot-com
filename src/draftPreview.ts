const repository = "https://github.com/JoshuaKGoldberg/dot-com";

interface DraftPreview {
	branch?: string;
	pullRequest?: string;
}

// https://vercel.com/docs/environment-variables/system-environment-variables
// https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#environment-variables
function getDraftPreview(): DraftPreview | undefined {
	const {
		VERCEL_ENV,
		VERCEL_GIT_COMMIT_REF,
		VERCEL_GIT_PULL_REQUEST_ID,
		WORKERS_CI,
		WORKERS_CI_BRANCH,
	} = process.env;

	if (VERCEL_ENV === "preview") {
		return {
			branch: VERCEL_GIT_COMMIT_REF,
			pullRequest: VERCEL_GIT_PULL_REQUEST_ID,
		};
	}

	// Workers Builds only says which branch it built, and main is production
	if (WORKERS_CI === "1" && WORKERS_CI_BRANCH && WORKERS_CI_BRANCH !== "main") {
		return { branch: WORKERS_CI_BRANCH };
	}

	return undefined;
}

// Vercel only knows a branch's pull request once one's open, and Workers Builds never does
function getLink({ branch, pullRequest }: DraftPreview) {
	if (pullRequest && /^\d+$/.test(pullRequest)) {
		return {
			href: `${repository}/pull/${pullRequest}`,
			text: `pull request #${pullRequest}`,
		};
	}

	if (branch) {
		return {
			href: `${repository}/pulls?${new URLSearchParams({ q: `is:pr head:${branch}` }).toString()}`,
			text: "its pull request",
		};
	}

	return { href: `${repository}/pulls`, text: "its pull request" };
}

const draftPreview = getDraftPreview();

/**
 * Where a preview deployment's pull request is, if this is building one.
 * Production and local builds don't have one.
 */
export const draftPreviewLink = draftPreview && getLink(draftPreview);
