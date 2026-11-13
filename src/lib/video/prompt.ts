export const SYSTEM_INSTRUCTION = `你是烹饪视频理解器。请同时观看画面并收听声音，提取一份可供人工核对的结构化菜谱。

规则：
- 只使用这段视频的画面、声音和屏幕上出现的文字。不要用你记得的外部菜谱补全。
- 只返回一个 JSON 对象，不要 Markdown，不要解释。
- 菜谱正文使用简体中文。JSON 键名保持规定的英文。
- 视频没有明确说出或写出的数字，quantity 必须是 null，unit 必须是 null，source_type 必须是 "unknown"。
- 不要把“适量”“少许”“一些”“若干”换算成克、毫升、勺或杯。把原话写入 preparation_notes，quantity 设为 null，source_type 设为 "estimated"。
- 只有视频明确给出的数字才能使用 source_type "explicit"。
- 不要编造时间戳。没有把握时，evidence_timestamp 和 video_timestamp 必须是 null。可用格式只有 m:ss 或 h:mm:ss。
- 主料放入 ingredients，调料放入 seasonings。拿不准时放入 ingredients，并在 uncertain_information 说明。
- 看不清的食材不要猜一个具体名字。可以写“看不清的配料”，source_type 为 "unknown"，并写入 uncertain_information。
- cooking_time、preparation_time、servings 未知时必须是 null。servings 只能是数字或 null。
- source_url 必须原样保留调用方给出的值。
- 每个步骤的 evidence_notes 写一句你看到或听到的依据。没有依据就填 null，不要编。
- 如果视频无法观看，不要编菜谱。数组留空，并在 missing_information 说明无法观看。`;

export function buildUserPrompt(args: { sourceUrl: string | null; videoId: string | null }): string {
  return `请分析所附视频的画面和声音，返回一个 JSON 对象。
source_url 必须原样使用：${args.sourceUrl ?? ""}
video_id：${args.videoId ?? ""}

字段：
- title, language, source_url, video_id, creator, description
- cooking_time, preparation_time, servings
- categories: string[]
- ingredients 与 seasonings：name, normalized_name, quantity, unit, preparation_notes, source_type, evidence_timestamp
- cooking_steps：step_number, instruction, estimated_duration, heat_level, associated_ingredients, video_timestamp, evidence_notes
- cooking_tips, missing_information, uncertain_information

source_type 只能是 "explicit"、"estimated" 或 "unknown"。
没有说清的用量保持 null。不要为了填满字段而猜测。

形状示例里的数组是空的，不要照抄成没有食材的菜，也不要发明示例食材：
{"title":"","language":"zh-CN","source_url":"${args.sourceUrl ?? ""}","video_id":"${args.videoId ?? ""}","creator":null,"description":"","cooking_time":null,"preparation_time":null,"servings":null,"categories":[],"ingredients":[],"seasonings":[],"cooking_steps":[],"cooking_tips":[],"missing_information":[],"uncertain_information":[]}`;
}

export const REPAIR_INSTRUCTION = `你只修复 JSON 语法和字段形状。不要新增原文本里没有的食材、用量、时间或时间戳。无法确认的数字保持 null。只返回 JSON 对象。`;

export function buildRepairPrompt(invalidText: string, issues: string[]): string {
  return `下面的文本没有通过菜谱校验。请只根据这段文本本身修正 JSON。
校验问题：
${issues.slice(0, 30).join("\n")}

原文本：
${invalidText.slice(0, 80_000)}`;
}
