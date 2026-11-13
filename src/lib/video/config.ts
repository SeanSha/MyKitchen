export const DEFAULT_VIDEO_MODEL = "gemini-3.8-flash";
export const DEFAULT_FALLBACK_VIDEO_MODEL = "gemini-3.6-flash";

export function configuredModel(): string {
  return process.env.GEMINI_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL;
}

export function fallbackModel(): string {
  return process.env.GEMINI_VIDEO_MODEL_FALLBACK?.trim() || DEFAULT_FALLBACK_VIDEO_MODEL;
}

export function credentialsConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
