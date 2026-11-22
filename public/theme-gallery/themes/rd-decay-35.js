import { activate as base } from "./gd-bloom.js";
import { withPost } from "./_type2/with-post.js";

// #434 rd-decay-35
export const activate = withPost(base, { title: "<span class=\"ty-l\">Hello.</span> <span class=\"ty-l\">I’m Josh.</span>", preconnect: ["https://fonts.gstatic.com"] });
