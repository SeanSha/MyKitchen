import { NextResponse } from "next/server";
import { analyzeYouTubeUrl } from "@/lib/video/analyze";
import { configuredModel, credentialsConfigured, fallbackModel } from "@/lib/video/config";
import { httpStatusForCode } from "@/lib/video/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET() {
  const denial = blocked();
  if (denial) return denial;
  return NextResponse.json({
    credentials_configured: credentialsConfigured(),
    model: configuredModel(),
    fallback_model: fallbackModel(),
  });
}

export async function POST(request: Request) {
  const denial = blocked();
  if (denial) return denial;
  const body = (await request.json().catch(() => null)) as { url?: unknown; mode?: unknown } | null;
  if (!body || typeof body.url !== "string") {
    return NextResponse.json({ ok: false, error: { code: "invalid_url", message: "请提供 YouTube 链接。" } }, { status: 400 });
  }
  const mode = body.mode === "metadata_only" ? "metadata_only" : "video";
  const result = await analyzeYouTubeUrl(body.url, { mode });
  return NextResponse.json(result, { status: result.ok ? 200 : httpStatusForCode(result.error.code) });
}

function blocked() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_VIDEO_IMPORT !== "true") {
    return NextResponse.json(
      { ok: false, error: { code: "provider", message: "视频导入接口在生产环境默认关闭。" } },
      { status: 403 },
    );
  }
  return null;
}
