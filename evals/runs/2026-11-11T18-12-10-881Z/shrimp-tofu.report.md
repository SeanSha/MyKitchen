# 虾头烧豆腐
提取质量门槛：未通过。
## 调用
- 模型：无
- 状态：model_unavailable
- 耗时：0.4 秒
- 是否真实视频请求：是
- 模式：video
- interaction：无
- 输入 tokens：未返回
- 输出 tokens：未返回
- 思考 tokens：未返回
- 估算费用：无法估算 USD
## 错误
- model_unavailable: 模型不可用：400 The value 'video' is not supported for 'input[1].type' in v1, it is available in v1beta. Change your version to v1beta to use this (https://ai.google.dev/gemini-api/docs/api-versions). Supported values: 'code_execution_call', 'code_execution_result', 'file_search_call', 'file_search_result', 'function_call', 'function_result', 'google_maps_call', 'google_maps_result', 'google_search_call', 'google_search_result', 'mcp_server_tool_call', 'mcp_server_tool_result', 'model_output', 'processing_call', 'processing_result', 'thought', 'url_context_call', 'url_context_result', 'user_input'.
## 元数据对照
- oEmbed 标题：【國宴大師•蝦頭燒豆腐】蝦頭別扔掉！試試配上5塊錢豆腐，鮮嫩又下飯～| 老飯骨
- oEmbed 作者：老饭骨
- 说明：oEmbed 只提供标题、作者和缩略图，不提供视频简介、字幕、配料或步骤。
## 检查
- 通过 真实调用：已经向视频理解接口发起请求。
- 失败 菜名：调用失败：model_unavailable 模型不可用：400 The value 'video' is not supported for 'input[1].type' in v1, it is available in v1beta. Change your version to v1beta to use this (https://ai.google.dev/gemini-api/docs/api-versions). Supported values: 'code_execution_call', 'code_execution_result', 'file_search_call', 'file_search_result', 'function_call', 'function_result', 'google_maps_call', 'google_maps_result', 'google_search_call', 'google_search_result', 'mcp_server_tool_call', 'mcp_server_tool_result', 'model_output', 'processing_call', 'processing_result', 'thought', 'url_context_call', 'url_context_result', 'user_input'.
- 失败 来源链接：没有菜谱结果，无法核对来源链接。
- 失败 食材完整性：没有菜谱结果。
- 失败 步骤：没有菜谱结果。
- 失败 视频理解证据：没有可检查的提取结果。
- 失败 时间戳：没有可检查的时间戳。
- 待核对 元数据对照：oEmbed 标题是“【國宴大師•蝦頭燒豆腐】蝦頭別扔掉！試試配上5塊錢豆腐，鮮嫩又下飯～| 老飯骨”，作者是“老饭骨”。这只是文本元数据。
- 待核对 评分背景：早先检查没有发现 YouTube 字幕。2026-11-11 的 oEmbed 标题是「【國宴大師•蝦頭燒豆腐】蝦頭別扔掉！試試配上5塊錢豆腐，鮮嫩又下飯～| 老飯骨」，作者是老饭骨。标题里已经有虾头、豆腐和“5块钱”，没有姜、葱、鸭蛋黄、胡萝卜或虾油。后四项以及提炼虾油若出现，就不能用标题解释。人工评分没有精确用量。
## 评分说明

早先检查没有发现 YouTube 字幕。2026-11-11 的 oEmbed 标题是「【國宴大師•蝦頭燒豆腐】蝦頭別扔掉！試試配上5塊錢豆腐，鮮嫩又下飯～| 老飯骨」，作者是老饭骨。标题里已经有虾头、豆腐和“5块钱”，没有姜、葱、鸭蛋黄、胡萝卜或虾油。后四项以及提炼虾油若出现，就不能用标题解释。人工评分没有精确用量。

## 改进
- 先看错误码。认证、配额、模型不存在和视频不可访问要分开处理，不能改成示例菜谱。
- 时间戳偏少或不可用时，保留空值。不要为了界面完整而补秒数。
- 如果结果只是标题复述，应降为低置信度，并允许改走元数据模式或上传用户有权处理的视频。
- YouTube URL 仍是预览能力。提供者保持在 GeminiVideoProvider 后面，方便以后更换。