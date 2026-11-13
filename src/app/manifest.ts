import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "我的厨房",
    short_name: "我的厨房",
    description: "个人菜谱、每周饭菜和采购清单。",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ecdf",
    theme_color: "#c24d24",
    lang: "zh-CN",
  };
}
