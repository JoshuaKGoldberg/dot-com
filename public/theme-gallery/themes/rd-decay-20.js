import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #433 rd-decay-20
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
