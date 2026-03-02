import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z.string().default("info"),
  EXPORT_STORAGE_DIR: z.string().default("./storage/exports"),
  EXPORT_WORKER_POLL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_STALE_LOCK_MINUTES: z.coerce.number().int().positive().default(20),
  PRESENTATION_IMAGES_MAX: z.coerce.number().int().nonnegative().default(3),
  PRESENTATION_IMAGE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(12000),
  PRESENTATION_ENABLE_AI_NOTES: z
    .string()
    .default("true")
    .transform((value) => value.trim().toLowerCase() === "true"),
  PRESENTATION_AI_NOTES_MAX_OBJECTIVES: z.coerce.number().int().positive().default(4),
  PRESENTATION_ENABLE_AI_IMAGES: z
    .string()
    .default("false")
    .transform((value) => value.trim().toLowerCase() === "true"),
  PRESENTATION_AI_IMAGE_PROVIDER: z
    .enum(["openai", "azure"])
    .default("openai"),
  OPENAI_IMAGES_API_KEY: z.string().optional(),
  OPENAI_IMAGES_MODEL: z.string().default("gpt-image-1"),
  OPENAI_IMAGES_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  AZURE_DALLE_ENDPOINT: z.string().optional(),
  AZURE_DALLE_API_KEY: z.string().optional(),
  AZURE_DALLE_MODEL: z.string().default("dall-e-3"),
  AZURE_DALLE_STYLE: z.enum(["vivid", "natural"]).default("vivid"),
  AZURE_DALLE_QUALITY: z.enum(["standard", "hd"]).default("standard"),
  INGESTION_CHUNK_SIZE: z.coerce.number().int().positive().default(1800),
  INGESTION_CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(300),
  CONNECTOR_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  OCR_FALLBACK_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value.trim().toLowerCase() === "true"),
  OCR_LANGUAGE: z.string().default("eng"),
  OCR_MIN_TEXT_LENGTH: z.coerce.number().int().nonnegative().default(100),
  OCR_PDF_MAX_PAGES: z.coerce.number().int().positive().default(5),
  OCR_DOCX_MAX_IMAGES: z.coerce.number().int().positive().default(8),
  OCR_PDF_RENDER_SCALE: z.coerce.number().positive().default(1.75),
  GENERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(45000),
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(5),
  RETRIEVAL_LESSON_PLAN_TOP_K: z.coerce.number().int().positive().default(20),
  RETRIEVAL_CANDIDATE_K: z.coerce.number().int().positive().default(180),
  RETRIEVAL_MIN_COVERAGE: z.coerce.number().int().positive().default(3),
  RETRIEVAL_VECTOR_WEIGHT: z.coerce.number().positive().default(40),
  RETRIEVAL_FTS_WEIGHT: z.coerce.number().nonnegative().default(18),
  INGESTION_EMBEDDINGS_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.trim().toLowerCase() === "true"),
  EMBEDDING_PROVIDER_PRIORITY: z.string().default("azure,gemini,local"),
  EMBEDDING_VECTOR_DIM: z.coerce.number().int().positive().default(1536),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AUTH_TOKEN_SECRET: z
    .string()
    .min(16)
    .default("replace_this_with_a_long_random_secret"),
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  SUPERADMIN_EMAIL: z.string().email().default("superadmin@edunurse.local"),
  SUPERADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  LLM_PROVIDER_PRIORITY: z.string().default("azure,gemini,deepseek"),
  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_API_VERSION: z.string().default("2024-10-21"),
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: z.string().optional(),
  AZURE_OPENAI_EMBEDDING_API_VERSION: z.string().default("2024-10-21"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("text-embedding-004"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com/v1/chat/completions"),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default("postmessage"),
  LENCO_API_KEY: z.string().optional(),
  LENCO_API_BASE_URL: z.string().default("https://api.lenco.co/access/v2"),
  EMAIL_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.trim().toLowerCase() === "true"),
  EMAIL_FROM: z.string().default("noreply@edunurse.com"),
  EMAIL_FROM_NAME: z.string().default("EduNurse"),
  SUPPORT_EMAIL: z.string().default("support@edunurse.com"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((value) => value.trim().toLowerCase() === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  WHATSAPP_GROUP_LINK: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues.map((issue) => issue.message).join(", ");
  throw new Error(`Invalid environment: ${errors}`);
}

export const env = parsed.data;
