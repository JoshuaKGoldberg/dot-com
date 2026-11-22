import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #412 t2-source-redaction
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
