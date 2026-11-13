# Phase 0 视频理解测试

两支视频都没有发送到 Gemini。

原因：当前环境没有 GEMINI_API_KEY。脚本在调用前停止，没有写入假菜谱，也没有把元数据当成视频理解结果。

把密钥写进 .env.local 后重新运行 npm run test:video。
