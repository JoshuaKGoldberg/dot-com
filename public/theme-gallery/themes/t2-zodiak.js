import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #424 t2-zodiak
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com", "https://cdn.fontshare.com"] });
