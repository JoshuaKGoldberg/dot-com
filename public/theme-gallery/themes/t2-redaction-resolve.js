import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #417 t2-redaction-resolve: the headline is stacked copies of Redaction cuts crossfaded with opacity; one real (clean) text, the rest aria-hidden.
const TEXT = "Hello. I’m Josh.";
const title = `<span class="t2-stack"><span class="t2-real">${TEXT}</span><span class="t2-c t2-c100" aria-hidden="true">${TEXT}</span><span class="t2-c t2-c50" aria-hidden="true">${TEXT}</span><span class="t2-c t2-c20" aria-hidden="true">${TEXT}</span></span>`;
export const activate = withPost(base, { title, preconnect: ["https://fonts.gstatic.com"] });
