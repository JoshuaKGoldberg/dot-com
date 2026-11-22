import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #436 rd-hedvig-ui
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
