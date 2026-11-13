export type IngredientSourceType = "explicit" | "estimated" | "unknown";

export interface RecipeIngredient {
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  preparation_notes: string | null;
  source_type: IngredientSourceType;
  evidence_timestamp: string | null;
}

export interface CookingStep {
  step_number: number;
  instruction: string;
  estimated_duration: string | null;
  heat_level: string | null;
  associated_ingredients: string[];
  video_timestamp: string | null;
  evidence_notes: string | null;
}

export interface RecipeDraft {
  title: string;
  language: string;
  source_url: string;
  video_id: string | null;
  creator: string | null;
  description: string;
  cooking_time: string | null;
  preparation_time: string | null;
  servings: number | null;
  categories: string[];
  ingredients: RecipeIngredient[];
  seasonings: RecipeIngredient[];
  cooking_steps: CookingStep[];
  cooking_tips: string[];
  missing_information: string[];
  uncertain_information: string[];
}

export type ExtractionMode = "video" | "metadata_only" | "uploaded_file";

export type VideoErrorCode =
  | "missing_credentials"
  | "invalid_url"
  | "inaccessible_video"
  | "model_unavailable"
  | "quota"
  | "auth"
  | "timeout"
  | "parse"
  | "provider"
  | "upload";

export interface ProviderAttempt {
  model: string;
  ok: boolean;
  status?: string;
  error?: string;
}

export interface NormalizedUsage {
  input_tokens: number | null;
  output_tokens: number | null;
  thought_tokens: number | null;
  cached_tokens: number | null;
  total_tokens: number | null;
  input_tokens_by_modality: unknown[] | null;
  raw: Record<string, unknown> | null;
}

export interface CostEstimate {
  currency: "USD";
  assumed_tier: "paid_standard_through_2026_12_31";
  input_usd_per_million: number;
  output_usd_per_million: number;
  estimated_input_usd: number | null;
  estimated_output_usd: number | null;
  estimated_total_usd: number | null;
  notes: string[];
}

export interface YouTubeMetadata {
  source: "youtube_oembed";
  title: string | null;
  author_name: string | null;
  author_url: string | null;
  thumbnail_url: string | null;
  provider_name: string | null;
  fetch_status: number | null;
  note: string;
}

export interface MetadataComparison {
  metadata_title: string | null;
  metadata_author: string | null;
  extracted_title: string;
  extracted_creator: string | null;
  title_matches_metadata: boolean | null;
  creator_matches_metadata: boolean | null;
  ingredients_beyond_metadata_text: string[];
  note: string;
}

export interface AnalysisSuccess {
  ok: true;
  live: boolean;
  provider: string;
  mode: ExtractionMode;
  model: string | null;
  interaction_id: string | null;
  status: string;
  duration_ms: number;
  usage: NormalizedUsage | null;
  estimated_cost: CostEstimate | null;
  warnings: string[];
  attempts: ProviderAttempt[];
  metadata: YouTubeMetadata | null;
  metadata_comparison: MetadataComparison | null;
  recipe: RecipeDraft;
  raw_text: string | null;
  repair_attempted: boolean;
}

export interface AnalysisFailure {
  ok: false;
  live: boolean;
  provider: string | null;
  mode: ExtractionMode | null;
  model: string | null;
  interaction_id: string | null;
  status: string | null;
  duration_ms: number;
  usage: NormalizedUsage | null;
  estimated_cost: CostEstimate | null;
  attempts: ProviderAttempt[];
  metadata: YouTubeMetadata | null;
  error: {
    code: VideoErrorCode;
    message: string;
    status?: number;
  };
  raw_text: string | null;
  repair_attempted: boolean;
}

export type AnalysisResponse = AnalysisSuccess | AnalysisFailure;

export interface ProviderRawResult {
  model: string;
  status: string;
  outputText: string;
  interactionId: string | null;
  usage: NormalizedUsage | null;
  attempts: ProviderAttempt[];
}

export interface VideoUnderstandingProvider {
  readonly id: string;
  analyze(request: ProviderAnalyzeRequest): Promise<ProviderRawResult>;
  repairJson?(request: {
    model: string;
    invalidText: string;
    issues: string[];
  }): Promise<ProviderRawResult>;
}

export type ProviderAnalyzeRequest = {
  sourceUrl: string | null;
  videoId: string | null;
  video:
    | { kind: "youtube"; uri: string }
    | { kind: "file"; path: string; mimeType: string; filename: string };
};
