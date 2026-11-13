const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export interface ParsedYouTubeUrl {
  videoId: string;
  canonicalUrl: string;
  originalUrl: string;
}

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const allowed = new Set([
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "youtube-nocookie.com",
  ]);
  if (!allowed.has(host)) return null;

  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") {
      id = parts[1] ?? null;
    }
  }

  if (!id || !VIDEO_ID.test(id)) return null;
  return {
    videoId: id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    originalUrl: trimmed,
  };
}
