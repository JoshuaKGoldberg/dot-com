import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #447 hv-redaction-titles
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
