import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z.string().default("3005"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  ALLOWED_ORIGINS: z.string().default("http://localhost:8080"),
  BACKEND_URL: z.string().default("http://localhost:3005"),
  FRONTEND_URL: z.string().default("http://localhost:8080"),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),

  // ------------------------------
  // 🔥 ADICIONAR VARIÁVEIS FIREBASE
  // ------------------------------
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  FIREBASE_STORAGE_BUCKET: z
    .string()
    .min(1, "FIREBASE_STORAGE_BUCKET is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

export default env;
