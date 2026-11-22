import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #413 t2-redaction-10
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
