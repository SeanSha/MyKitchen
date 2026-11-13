import type { YouTubeMetadata } from "./types";

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unavailable(status: number | null, note: string): YouTubeMetadata {
  return {
    source: "youtube_oembed",
    title: null,
    author_name: null,
    author_url: null,
    thumbnail_url: null,
    provider_name: null,
    fetch_status: status,
    note,
  };
}

export async function fetchYouTubeMetadata(canonicalUrl: string): Promise<YouTubeMetadata> {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`;
  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MyKitchenPhase0/0.1",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return unavailable(
        response.status,
        `YouTube oEmbed 返回 HTTP ${response.status}。没有取到公开标题或作者。oEmbed 失败不等于视频理解已经失败。`,
      );
    }
    const body = (await response.json()) as Record<string, unknown>;
    return {
      source: "youtube_oembed",
      title: asText(body.title),
      author_name: asText(body.author_name),
      author_url: asText(body.author_url),
      thumbnail_url: asText(body.thumbnail_url),
      provider_name: asText(body.provider_name),
      fetch_status: response.status,
      note: "oEmbed 只提供标题、作者和缩略图，不提供视频简介、字幕、配料或步骤。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return unavailable(null, `YouTube oEmbed 请求失败：${message}`);
  }
}
