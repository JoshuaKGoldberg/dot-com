import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #449 rn-light-400
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"], motionControl: true });
