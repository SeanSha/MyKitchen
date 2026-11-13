import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { analyzeUploadedVideo } from "@/lib/video/analyze";
import { httpStatusForCode } from "@/lib/video/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 80 * 1024 * 1024;
const MIME_TYPES = new Map<string, string>([
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["video/mpeg", ".mpeg"],
]);

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_VIDEO_IMPORT !== "true") {
    return NextResponse.json(
      { ok: false, error: { code: "provider", message: "视频导入接口在生产环境默认关闭。" } },
      { status: 403 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const sourceUrl = form?.get("sourceUrl");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: { code: "upload", message: "请选择一个你有权处理的视频文件。" } }, { status: 400 });
  }
  if (!MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: { code: "upload", message: "目前只接受 MP4、WebM、MOV 或 MPEG 视频。" } },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: { code: "upload", message: "视频超过 80MB。" } }, { status: 400 });
  }

  const directory = await mkdtemp(path.join(os.tmpdir(), "my-kitchen-"));
  const filePath = path.join(directory, `${randomUUID()}${MIME_TYPES.get(file.type)}`);
  try {
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    const result = await analyzeUploadedVideo({
      path: filePath,
      mimeType: file.type,
      filename: file.name || "upload",
      sourceUrl: typeof sourceUrl === "string" ? sourceUrl : null,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : httpStatusForCode(result.error.code) });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
