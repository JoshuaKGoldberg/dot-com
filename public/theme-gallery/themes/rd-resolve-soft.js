import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #438 rd-resolve-soft: one real clean heading plus an aria-hidden Redaction 20 copy; opacity-only crossfade.
const TEXT = "Hello. I’m Josh.";
const title = `<span class="t2-stack"><span class="t2-real">${TEXT}</span><span class="t2-c" aria-hidden="true">${TEXT}</span></span>`;
export const activate = withPost(base, { title, preconnect: ["https://fonts.gstatic.com"] });
