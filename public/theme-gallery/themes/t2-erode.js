import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #425 t2-erode
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com", "https://cdn.fontshare.com"] });
