import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #411 t2-source-serif-bold
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
