# 蒜香白蘑菇炒牛肉片
提取质量门槛：未通过。
## 调用
- 模型：无
- 状态：model_unavailable
- 耗时：0.3 秒
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
- oEmbed 标题：比餐馆的还好吃💯 用Costco 的白蘑菇做蒜香蘑菇炒牛肉片 鲜爽嫩滑 10分钟搞定！
- oEmbed 作者：Chaye Cooking 茶叶的一日三餐
- 说明：oEmbed 只提供标题、作者和缩略图，不提供视频简介、字幕、配料或步骤。
## 检查
- 通过 真实调用：已经向视频理解接口发起请求。
- 失败 菜名：调用失败：model_unavailable 模型不可用：400 The value 'video' is not supported for 'input[1].type' in v1, it is available in v1beta. Change your version to v1beta to use this (https://ai.google.dev/gemini-api/docs/api-versions). Supported values: 'code_execution_call', 'code_execution_result', 'file_search_call', 'file_search_result', 'function_call', 'function_result', 'google_maps_call', 'google_maps_result', 'google_search_call', 'google_search_result', 'mcp_server_tool_call', 'mcp_server_tool_result', 'model_output', 'processing_call', 'processing_result', 'thought', 'url_context_call', 'url_context_result', 'user_input'.
- 失败 来源链接：没有菜谱结果，无法核对来源链接。
- 失败 食材完整性：没有菜谱结果。
- 失败 步骤：没有菜谱结果。
- 失败 视频理解证据：没有可检查的提取结果。
- 失败 时间戳：没有可检查的时间戳。
- 待核对 元数据对照：oEmbed 标题是“比餐馆的还好吃💯 用Costco 的白蘑菇做蒜香蘑菇炒牛肉片 鲜爽嫩滑 10分钟搞定！”，作者是“Chaye Cooking 茶叶的一日三餐”。这只是文本元数据。
- 待核对 评分背景：2026-11-11 的 oEmbed 标题是「比餐馆的还好吃💯 用Costco 的白蘑菇做蒜香蘑菇炒牛肉片 鲜爽嫩滑 10分钟搞定！」，作者是 Chaye Cooking 茶叶的一日三餐。标题里已有牛肉、白蘑菇、蒜香和“10分钟”，这些不能单独当成看过视频的证据。黄油、欧芹、腌制 15 分钟、翻炒约 2 分钟、三瓣蒜、淀粉、酱油和嫩肉用料不在标题里。评分标准只确认蒜是三瓣，没有把未经视频核对的其他数字写进来。
## 评分说明

2026-11-11 的 oEmbed 标题是「比餐馆的还好吃💯 用Costco 的白蘑菇做蒜香蘑菇炒牛肉片 鲜爽嫩滑 10分钟搞定！」，作者是 Chaye Cooking 茶叶的一日三餐。标题里已有牛肉、白蘑菇、蒜香和“10分钟”，这些不能单独当成看过视频的证据。黄油、欧芹、腌制 15 分钟、翻炒约 2 分钟、三瓣蒜、淀粉、酱油和嫩肉用料不在标题里。评分标准只确认蒜是三瓣，没有把未经视频核对的其他数字写进来。

## 改进
- 先看错误码。认证、配额、模型不存在和视频不可访问要分开处理，不能改成示例菜谱。
- 时间戳偏少或不可用时，保留空值。不要为了界面完整而补秒数。
- 如果结果只是标题复述，应降为低置信度，并允许改走元数据模式或上传用户有权处理的视频。
- YouTube URL 仍是预览能力。提供者保持在 GeminiVideoProvider 后面，方便以后更换。