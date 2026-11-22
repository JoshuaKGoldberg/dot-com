import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #426 t2-brygada
export const activate = withPost(base, { preconnect: ["https://fonts.gstatic.com"] });
