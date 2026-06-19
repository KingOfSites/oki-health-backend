// OKI 26/05/2026 #2 (V2): integração com Mercado Pago para PIX Out
// automático nos saques. Quando MP_PAYOUT_ENABLED=true e a flag estiver
// suportada pela conta MP da Oki, approveWithdrawalRequest deixa de
// exigir trabalho manual — o PIX sai sozinho e o webhook fecha o saque
// quando o MP confirmar.
//
// IMPORTANTE: a API de payouts do MP NÃO é self-service. É preciso
// abrir um chamado comercial com o gerente da conta (CNPJ
// 51.805.819/0001-67) e pedir liberação de PIX Out. Enquanto não
// ativarem, deixe MP_PAYOUT_ENABLED=false — o fluxo continua manual
// (admin recebe a chave PIX no painel e envia pelo banco da Oki).

import crypto from "crypto";
import { env } from "../config/env";

const ACCESS_TOKEN =
  process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || "";

export type PixKeyType = "cpf" | "email" | "phone" | "random";

export interface SendPixInput {
  /** Valor do PIX em reais (ex.: 50.00). */
  amountReais: number;
  /** Chave PIX do beneficiário. */
  pixKey: string;
  /** Tipo da chave PIX. */
  pixKeyType: PixKeyType;
  /** CPF do beneficiário, somente dígitos. */
  beneficiaryCpf: string;
  /** Nome completo do beneficiário, conforme cadastro do banco. */
  beneficiaryName: string;
  /** Descrição visível no extrato (até 50 chars). */
  description?: string;
  /** Chave de idempotência da requisição. Gera UUID se não informada. */
  idempotencyKey?: string;
}

export interface SendPixResult {
  /** true se a chamada foi enviada ao MP (ou se foi dry-run aceito). */
  ok: boolean;
  /** ID do payout no MP. Vazio se ok=false ou dry-run. */
  payoutId: string | null;
  /** pending | processing | approved | rejected | failed | dry_run. */
  status: string;
  /** Mensagem de erro/aviso, se houver. */
  error?: string;
  /** Resposta crua do MP (para auditoria). */
  raw?: any;
}

/**
 * Envia um PIX via API de payouts do Mercado Pago.
 *
 * Comportamento conforme env:
 * - MP_PAYOUT_ENABLED=false → retorna dry-run sem chamar a API.
 *   Usado para o ambiente atual da Oki, onde o admin ainda processa
 *   manualmente. Permite que o resto do fluxo (estados, webhook,
 *   transações) já esteja todo plugado, esperando só a flag virar.
 * - MP_PAYOUT_ENABLED=true → chama POST ${MP_PAYOUT_ENDPOINT} com o
 *   token de acesso. Retorna payoutId + status para persistir.
 */
export class MpPayoutService {
  static isEnabled(): boolean {
    return Boolean(env.MP_PAYOUT_ENABLED) && Boolean(ACCESS_TOKEN);
  }

  static async sendPix(input: SendPixInput): Promise<SendPixResult> {
    const idempotencyKey = input.idempotencyKey || crypto.randomUUID();

    if (!this.isEnabled()) {
      console.log(
        "[MpPayout] DRY-RUN — MP_PAYOUT_ENABLED=false ou access token ausente. " +
          "Saque seguirá fluxo manual.",
        { amount: input.amountReais, pixKey: maskKey(input.pixKey, input.pixKeyType) },
      );
      return {
        ok: true,
        payoutId: null,
        status: "dry_run",
      };
    }

    if (!env.MP_PAYOUT_USER_ID) {
      return {
        ok: false,
        payoutId: null,
        status: "failed",
        error:
          "MP_PAYOUT_USER_ID não configurado. Solicite ao gerente do Mercado Pago.",
      };
    }

    const body = {
      // Conforme docs da API de payouts do MP. Campos podem variar de
      // acordo com o que o gerente liberar — ajustar aqui após teste
      // de homologação.
      external_reference: idempotencyKey,
      transaction_amount: round2(input.amountReais),
      description: (input.description || "Saque Oki Health").slice(0, 50),
      payer_id: env.MP_PAYOUT_USER_ID,
      receiver: {
        pix_key: normalizeKey(input.pixKey, input.pixKeyType),
        pix_key_type: input.pixKeyType,
        first_name: firstName(input.beneficiaryName),
        last_name: lastName(input.beneficiaryName),
        identification: {
          type: "CPF",
          number: input.beneficiaryCpf.replace(/\D/g, ""),
        },
      },
      metadata: {
        source: "oki-health-backend",
        idempotency_key: idempotencyKey,
      },
    };

    try {
      const res = await fetch(env.MP_PAYOUT_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      const raw = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        console.error("[MpPayout] MP recusou o payout:", res.status, raw);
        return {
          ok: false,
          payoutId: raw?.id ? String(raw.id) : null,
          status: raw?.status || "failed",
          error: raw?.message || `MP retornou ${res.status}`,
          raw,
        };
      }

      return {
        ok: true,
        payoutId: raw?.id ? String(raw.id) : null,
        status: raw?.status || "processing",
        raw,
      };
    } catch (err: any) {
      console.error("[MpPayout] Erro de rede chamando MP:", err);
      return {
        ok: false,
        payoutId: null,
        status: "failed",
        error: err?.message || "Erro de rede ao contatar Mercado Pago",
      };
    }
  }

  /**
   * Valida assinatura do webhook de payout. MP envia um header
   * x-signature no padrão `ts=...,v1=...` — comparamos o HMAC SHA-256
   * do body com o segredo configurado.
   */
  static verifyWebhookSignature(headers: Record<string, string>, rawBody: string): boolean {
    const secret = env.MP_PAYOUT_WEBHOOK_SECRET;
    if (!secret) {
      // Sem segredo configurado, não tem como validar. Aceita em
      // desenvolvimento e loga aviso.
      console.warn("[MpPayout] MP_PAYOUT_WEBHOOK_SECRET ausente — webhook sem validação.");
      return true;
    }

    const sigHeader = headers["x-signature"] || headers["X-Signature"];
    if (!sigHeader) return false;

    const parts = String(sigHeader)
      .split(",")
      .map((p) => p.trim().split("="));
    const v1 = parts.find((p) => p[0] === "v1")?.[1];
    if (!v1) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // Comparação constante para evitar timing attacks.
    try {
      const a = Buffer.from(v1, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}

// ---------------- helpers ----------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function firstName(full: string): string {
  return String(full || "").trim().split(/\s+/)[0] || "";
}

function lastName(full: string): string {
  const parts = String(full || "").trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function normalizeKey(key: string, type: PixKeyType): string {
  const raw = String(key || "").trim();
  if (type === "cpf" || type === "phone") return raw.replace(/\D/g, "");
  if (type === "email") return raw.toLowerCase();
  return raw; // random (UUID)
}

function maskKey(key: string, type: PixKeyType): string {
  const raw = normalizeKey(key, type);
  if (raw.length <= 4) return raw;
  return raw.slice(0, 2) + "***" + raw.slice(-2);
}
