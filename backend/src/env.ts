import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 chars"),
  /** Public URL of THIS api server. */
  BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
  /** Public URL of the frontend; used for CORS and trusted origins. */
  APP_URL: z.url().default("http://localhost:3100"),
  /** Timezone for recurring-task trigger times. Railway servers run on UTC. */
  TZ: z.string().default("Asia/Kolkata"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("\nInvalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nCopy backend/.env.example to backend/.env and fill it in.\n");
  process.exit(1);
}

export const env = parsed.data;

// Recurring tasks fire at wall-clock times like 09:00, so pin the process
// timezone before anything computes a date.
process.env.TZ = env.TZ;
export const isProd = env.NODE_ENV === "production";
