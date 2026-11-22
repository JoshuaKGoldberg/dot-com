import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #452 rn-dark-tuned
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"], motionControl: true });
