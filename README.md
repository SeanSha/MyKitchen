# 我的厨房

公开 YouTube 烹饪视频可以交给 Gemini 抽出可编辑的菜谱草稿。草稿保存后进入菜谱库，再排进周一到周日的午饭和晚饭，采购清单按这一周汇总。

菜谱、安排和“家里已有”的勾选保存在当前浏览器的 localStorage。还没有账号，换设备不会同步。

底部四个入口：

- 首页：今天的饭和这周接下来的安排
- 菜谱：搜索、收藏、做过记录，以及从视频加入
- 本周：给每天的午饭和晚饭放菜、改份数、挪动或移除
- 采购：按份数换算，只合并能换算的单位，用量未知保持未知

视频分析仍在 [http://localhost:3000/dev/video-import](http://localhost:3000/dev/video-import)。分析完成后点“保存到菜谱库”。菜谱页也可以导入最近一次真实识别结果，不会另造用量。

## 做法

视频理解使用官方 [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding) 文档里的 Interactions API：

- SDK：`@google/genai` 3.1.0
- 默认模型：`gemini-3.8-flash`
- 公开 YouTube 链接放在 `input` 的 `video.uri` 里，不下载视频
- 请求使用 `v1beta`。SDK 默认的 `v1` 不接受视频输入
- 密钥只放在服务器环境变量 `GEMINI_API_KEY`
- 模型输出用 Zod 校验。没说清的用量保持 `null`，来源标成 `unknown`
- YouTube URL 目前仍是预览功能，文档写明暂不另收费，价格和限额可能变化

`GeminiVideoProvider` 是唯一知道 Gemini 请求格式的地方。以后可以换成别的视频理解实现。

公开标题和作者来自 YouTube oEmbed。oEmbed 没有简介、字幕、配料或步骤。元数据模式会明确标成低置信度，不会假装看过视频。

## 环境

需要 Node.js 22 或 24。当前机器是 Node.js 23，ESLint 10 的引擎声明不包含 23，但检查可以运行。TypeScript 使用 6.0.3，因为项目里的 `typescript-eslint` 还不支持 TypeScript 7。

```bash
npm install
cp .env.example .env.local
```

在 `.env.local` 写入从 [Google AI Studio](https://aistudio.google.com/apikey) 创建的密钥：

```bash
GEMINI_API_KEY=你的密钥
GEMINI_VIDEO_MODEL=gemini-3.8-flash
GEMINI_VIDEO_MODEL_FALLBACK=gemini-3.6-flash
```

备用模型只在主模型 ID 不存在时使用。不要把密钥写成 `NEXT_PUBLIC_` 变量。

## 开发和测试

```bash
npm run dev
```

打开 [http://localhost:3000/dev/video-import](http://localhost:3000/dev/video-import)。页面可以粘贴链接、分析视频、修改草稿、查看原视频。嵌入被 YouTube 阻止时，使用页面上的原始链接。

```bash
npm test
npm run test:video
```

`npm test` 不访问 Gemini，只检查链接解析、用量清洗、元数据模式和评分逻辑。

`npm run test:video` 会真实请求这两支视频：

- 虾头烧豆腐：https://www.youtube.com/watch?v=1BZyz-fw_YE
- 蒜香白蘑菇炒牛肉片：https://www.youtube.com/watch?v=FjfN732wQlU

它也会检查一个无效链接，以及一个格式正确但不可用的视频 ID。输出在 `evals/runs/<时间>/`，总结写到 `evals/PHASE0_EVALUATION.md`。没有密钥时脚本会停止，不会写入假菜谱。

免费层每天通过 YouTube URL 处理的视频时长上限是 8 小时。两支视频合计大约 12 分钟。

## 费用

`gemini-3.8-flash` 标准付费层在 2026-12-31 前是输入 0.75 美元 / 100 万 tokens，输出含思考 tokens 3.75 美元 / 100 万 tokens。免费层标价为 0。YouTube URL 预览目前不另收费。测试报告里的金额是按付费标准层估算的，不是账单。

## 失败时会发生什么

- 无效链接在本地拒绝，不调用模型
- 认证、配额、模型不存在、视频无法访问和 JSON 解析失败会返回不同错误
- 页面保留原始模型输出，方便对照
- JSON 形状不对时，会再发一次不带视频的修复请求；修复不能新增事实
- 视频理解失败后，可以手动改用元数据模式，或上传自己有权处理的视频

生产环境默认关闭这两个接口。部署前设置 `ALLOW_VIDEO_IMPORT=true` 才会打开，而且仍然不应该把带密钥的服务公开到没有访问控制的网上。

## 还没有做

登录、Supabase 和跨设备同步还没接。可安装图标也还没有。采购清单只在这台浏览器里跟着本周安排变化。
