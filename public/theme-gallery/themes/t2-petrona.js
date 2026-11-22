import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #427 t2-petrona
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
