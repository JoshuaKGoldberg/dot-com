import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #432 rd-decay-10
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
