import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #418 t2-redaction-code
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com", "https://cdn.jsdelivr.net"] });
