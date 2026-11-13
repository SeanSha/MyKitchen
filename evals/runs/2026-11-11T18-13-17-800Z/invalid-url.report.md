# 无效链接
提取质量门槛：未通过。
## 调用
- 模型：无
- 状态：invalid_url
- 耗时：0.0 秒
- 是否真实视频请求：否
- 模式：video
- interaction：无
- 输入 tokens：未返回
- 输出 tokens：未返回
- 思考 tokens：未返回
- 估算费用：无法估算 USD
## 错误
- invalid_url: 这不是可用的公开 YouTube 视频链接。
## 元数据对照
- 没有 oEmbed 结果。
## 检查
- 通过 本地拒绝无效链接：这不是可用的公开 YouTube 视频链接。
## 改进
- 先看错误码。认证、配额、模型不存在和视频不可访问要分开处理，不能改成示例菜谱。
- YouTube URL 仍是预览能力。提供者保持在 GeminiVideoProvider 后面，方便以后更换。