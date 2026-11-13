export interface RubricTerm {
  id: string;
  label: string;
  aliases: string[];
}

export interface VideoRubric {
  id: string;
  title: string;
  url: string;
  creatorHints: string[];
  durationLabel: string;
  durationSeconds: number;
  captionsExpected: boolean;
  ingredients: RubricTerm[];
  techniques: RubricTerm[];
  timings: Array<{ id: string; label: string; pattern: RegExp }>;
  exactQuantities: Array<{ id: string; label: string; aliases: string[]; quantity: number; units: string[] }>;
  mentionedQuantities: RubricTerm[];
  order: Array<{ id: string; label: string; before: string[]; after: string[] }>;
  quantityRiskExplicitCount: number | null;
  notes: string;
}

export const VIDEO_RUBRICS: VideoRubric[] = [
  {
    id: "shrimp-tofu",
    title: "虾头烧豆腐",
    url: "https://www.youtube.com/watch?v=1BZyz-fw_YE",
    creatorHints: ["老饭骨"],
    durationLabel: "约 7 分 24 秒",
    durationSeconds: 7 * 60 + 24,
    captionsExpected: false,
    ingredients: [
      { id: "shrimp-head", label: "虾头", aliases: ["虾头"] },
      { id: "tofu", label: "豆腐", aliases: ["豆腐"] },
      { id: "ginger", label: "姜", aliases: ["生姜", "姜片", "姜丝", "姜末", "姜"] },
      { id: "scallion", label: "葱", aliases: ["小葱", "大葱", "葱花", "葱段", "葱"] },
      { id: "duck-yolk", label: "鸭蛋黄", aliases: ["鸭蛋黄", "咸鸭蛋", "蛋黄"] },
      { id: "carrot", label: "胡萝卜", aliases: ["胡萝卜", "红萝卜"] },
    ],
    techniques: [
      { id: "shrimp-oil", label: "提炼虾油", aliases: ["虾油", "炼油", "煸出", "炸出"] },
      { id: "stock", label: "虾汤或高汤", aliases: ["虾汤", "高汤", "吊汤", "汤汁"] },
      { id: "simmer", label: "烧或炖豆腐", aliases: ["烧豆腐", "炖", "焖", "收汁", "入味"] },
    ],
    timings: [],
    exactQuantities: [],
    mentionedQuantities: [],
    order: [{ id: "oil-before-simmer", label: "先提炼虾油，再烧豆腐", before: ["虾油"], after: ["烧", "炖", "焖"] }],
    quantityRiskExplicitCount: 4,
    notes: "早先检查没有发现 YouTube 字幕。2026-11-11 的 oEmbed 标题是「【國宴大師•蝦頭燒豆腐】蝦頭別扔掉！試試配上5塊錢豆腐，鮮嫩又下飯～| 老飯骨」，作者是老饭骨。标题里已经有虾头、豆腐和“5块钱”，没有姜、葱、鸭蛋黄、胡萝卜或虾油。后四项以及提炼虾油若出现，就不能用标题解释。人工评分没有精确用量。",
  },
  {
    id: "beef-mushroom",
    title: "蒜香白蘑菇炒牛肉片",
    url: "https://www.youtube.com/watch?v=FjfN732wQlU",
    creatorHints: ["Chaye", "Chaye Cooking"],
    durationLabel: "约 4 分 42 秒",
    durationSeconds: 4 * 60 + 42,
    captionsExpected: true,
    ingredients: [
      { id: "beef", label: "牛肉", aliases: ["牛肉"] },
      { id: "mushroom", label: "白蘑菇", aliases: ["白蘑菇", "蘑菇", "口蘑"] },
      { id: "garlic", label: "蒜", aliases: ["大蒜", "蒜瓣", "蒜末", "蒜片", "蒜"] },
      { id: "butter", label: "黄油", aliases: ["黄油"] },
      { id: "parsley", label: "欧芹", aliases: ["欧芹", "香芹", "荷兰芹", "parsley"] },
    ],
    techniques: [
      { id: "marinate", label: "腌制牛肉", aliases: ["腌"] },
      { id: "stir", label: "快炒", aliases: ["炒", "翻炒"] },
    ],
    timings: [
      { id: "marinate-15", label: "腌制约 15 分钟", pattern: /腌[^。\n]{0,24}15\s*分钟|15\s*分钟[^。\n]{0,16}腌/ },
      { id: "stir-2", label: "炒制约 2 分钟", pattern: /(?:炒|翻炒)[^。\n]{0,24}(?:2|两)\s*分钟|(?:2|两)\s*分钟[^。\n]{0,16}(?:炒|翻炒)/ },
    ],
    exactQuantities: [{ id: "garlic-3", label: "蒜三瓣", aliases: ["蒜"], quantity: 3, units: ["瓣", "clove", "颗"] }],
    mentionedQuantities: [
      { id: "starch", label: "淀粉", aliases: ["淀粉", "生粉", "玉米淀粉"] },
      { id: "soy", label: "酱油", aliases: ["酱油", "生抽", "豉油"] },
      { id: "tenderizer", label: "嫩肉或膨松用料", aliases: ["嫩肉粉", "松肉粉", "小苏打", "苏打粉", "泡打粉"] },
    ],
    order: [{ id: "marinate-before-stir", label: "先腌制，再下锅快炒", before: ["腌"], after: ["炒", "翻炒"] }],
    quantityRiskExplicitCount: null,
    notes: "2026-11-11 的 oEmbed 标题是「比餐馆的还好吃💯 用Costco 的白蘑菇做蒜香蘑菇炒牛肉片 鲜爽嫩滑 10分钟搞定！」，作者是 Chaye Cooking 茶叶的一日三餐。标题里已有牛肉、白蘑菇、蒜香和“10分钟”，这些不能单独当成看过视频的证据。黄油、欧芹、腌制 15 分钟、翻炒约 2 分钟、三瓣蒜、淀粉、酱油和嫩肉用料不在标题里。评分标准只确认蒜是三瓣，没有把未经视频核对的其他数字写进来。",
  },
];

export const INVALID_VIDEO_URL = "https://example.com/not-a-youtube-video";
export const INACCESSIBLE_VIDEO_URL = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
