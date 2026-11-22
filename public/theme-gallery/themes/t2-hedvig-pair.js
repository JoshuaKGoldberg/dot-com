import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #419 t2-hedvig-pair
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
