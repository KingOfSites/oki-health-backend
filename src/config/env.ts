import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  PORT: z.string().default("3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  ALLOWED_ORIGINS: z.string().default("http://localhost:8080"),
  BACKEND_URL: z.string().default("https://okibackend.solidtech.digital"),
  FRONTEND_URL: z.string().default("http://localhost:8080"),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),

  // ------------------------------
  // 🧩 MERCADO PAGO — MARKETPLACE SPLIT (entrada do desafio)
  // ------------------------------
  // Aplicação Marketplace criada no painel MP da conta Oki principal.
  // Usada pra OAuth da conta "OKI POOL" (que vai receber 75% das
  // entradas) e pra aplicar `application_fee=25%` nas cobranças.
  // Self-service no MP — não precisa chamado comercial.
  MP_MARKETPLACE_CLIENT_ID: z.string().optional(),
  MP_MARKETPLACE_CLIENT_SECRET: z.string().optional(),
  MP_MARKETPLACE_REDIRECT_URI: z
    .string()
    .default("https://okibackend.solidtech.digital/api/wallet/mp-oauth-callback"),
  // Percentual da taxa administrativa (em decimal). 0.25 = 25%.
  // Mantido em sync com ADMIN_FEE_RATE de utils/adminFee.ts.
  MP_MARKETPLACE_APPLICATION_FEE_RATE: z
    .string()
    .default("0.25")
    .transform((v) => {
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n < 0 || n >= 1) return 0.25;
      return n;
    }),

  // ------------------------------
  // 💸 MERCADO PAGO — PIX OUT (Money Out)
  // ------------------------------
  // Feature flag para automatizar o saque PIX via API do Mercado Pago.
  // Default off — quando true, approveWithdrawalRequest dispara o PIX
  // sozinho e o webhook fecha o saque ao confirmar.
  // Para ativar: gerente comercial do MP precisa habilitar PIX Out na
  // conta da Oki Health (CNPJ 51.805.819/0001-67).
  MP_PAYOUT_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  // ID do usuário/conta MP da Oki que vai pagar os PIX (recebido pelo
  // gerente quando ativar payout). Em geral coincide com o "user_id" do
  // access token, mas pode ser diferente para subcontas.
  MP_PAYOUT_USER_ID: z.string().optional(),
  // Endpoint do MP para criar o payout. Default é o produtivo padrão.
  // Pode ser sobrescrito em sandbox/homologação se o MP fornecer outro.
  MP_PAYOUT_ENDPOINT: z
    .string()
    .default("https://api.mercadopago.com/v1/payouts"),
  // Secret do webhook de payouts (vem do painel MP).
  MP_PAYOUT_WEBHOOK_SECRET: z.string().optional(),

  // ------------------------------
  // 🔥 VARIÁVEIS FIREBASE (opcionais para desenvolvimento)
  // ------------------------------
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
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
