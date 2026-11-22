import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #451 rn-optical
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"], motionControl: true });
