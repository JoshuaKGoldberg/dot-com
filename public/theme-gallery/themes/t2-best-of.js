import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #428 t2-best-of
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
