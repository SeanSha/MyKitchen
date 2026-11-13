# 无法访问的视频
提取质量门槛：未通过。
## 调用
- 模型：无
- 状态：auth
- 耗时：0.4 秒
- 是否真实视频请求：是
- 模式：video
- interaction：无
- 输入 tokens：未返回
- 输出 tokens：未返回
- 思考 tokens：未返回
- 估算费用：无法估算 USD
## 错误
- auth: Gemini 认证失败：403 The caller does not have permission
## 元数据对照
- oEmbed 标题：无
- oEmbed 作者：无
- 说明：YouTube oEmbed 返回 HTTP 400。没有取到公开标题或作者。oEmbed 失败不等于视频理解已经失败。
## 检查
- 通过 不返回编造菜谱：接口拒绝了这次请求：auth Gemini 认证失败：403 The caller does not have permission
## 改进
- 先看错误码。认证、配额、模型不存在和视频不可访问要分开处理，不能改成示例菜谱。
- YouTube URL 仍是预览能力。提供者保持在 GeminiVideoProvider 后面，方便以后更换。