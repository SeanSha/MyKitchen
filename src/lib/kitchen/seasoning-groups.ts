export const SEASONING_GROUPS = ["盐和糖", "酱油和醋", "酒", "油", "酱料", "香料", "淀粉和提鲜", "其他"] as const;

export type SeasoningGroup = (typeof SEASONING_GROUPS)[number];

export function seasoningGroup(name: string): SeasoningGroup {
  const text = name.trim();
  if (/^(热|开|清|温)?水$/.test(text)) return "其他";
  if (/生抽|老抽|味极鲜|美极鲜|蒸鱼豉油|酱油|醋/.test(text)) return "酱油和醋";
  if (/料酒|黄酒|米酒|花雕|清酒|白酒|啤酒|露酒|酒/.test(text)) return "酒";
  if (/酱|腐乳|南乳|鱼露|虾酱|豆瓣|蚝油|耗油/.test(text)) return "酱料";
  if (/油/.test(text)) return "油";
  if (/胡椒|花椒|香叶|八角|五香|辣椒|椒粉|孜然|十三香|桂皮|香料|欧芹|洋葱粉|大蒜粉|蒜粉|蒜泥|椒盐|paprika/i.test(text)) return "香料";
  if (/盐|糖/.test(text)) return "盐和糖";
  if (/淀粉|生粉|苏打|泡打粉|味精|鸡精|鸡汁|松茸鲜/.test(text)) return "淀粉和提鲜";
  return "其他";
}

export function householdSeasoningName(name: string): string {
  const stripped = name.replace(/\s*[（(][^）)]*[）)]\s*/g, " ").replace(/\s+/g, " ").trim();
  const compact = stripped.replace(/\s+/g, "");
  if (!compact) return name.trim();
  if (isPlainSalt(compact)) return /粗/.test(compact) ? "粗盐" : "精盐";
  if (isPlainSugar(compact)) {
    if (compact.includes("冰糖")) return "冰糖";
    if (/红糖|黑糖/.test(compact)) return "红糖";
    return "白糖";
  }
  return stripped;
}

function isPlainSalt(text: string): boolean {
  if (/酱油|椒盐|酱|醋|油/.test(text)) return false;
  return text.includes("盐");
}

function isPlainSugar(text: string): boolean {
  if (/糖醋|糖色|酱油|抽|酱/.test(text)) return false;
  return text.includes("糖");
}

export function groupSeasonings(names: string[]): Array<{ group: SeasoningGroup; names: string[] }> {
  return SEASONING_GROUPS.map((group) => ({
    group,
    names: names.filter((name) => seasoningGroup(name) === group).sort((a, b) => a.localeCompare(b, "zh-CN")),
  })).filter((entry) => entry.names.length > 0);
}
