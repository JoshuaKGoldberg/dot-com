import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #415 t2-redaction-50
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
