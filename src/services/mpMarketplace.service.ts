// OKI 26/05/2026 — split na entrada do desafio via MP Marketplace.
// Esse serviço encapsula tudo que envolve o OAuth + uso do
// access_token da conta Pool: troca de code, refresh automático,
// consulta com renovação preventiva quando faltar < 30 dias para
// expirar.

import prisma from "../config/database";
import { env } from "../config/env";

const MP_OAUTH_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const POOL_ROLE = "pool";

export type MpOAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number | string;
  refresh_token: string;
  public_key?: string;
};

export class MpMarketplaceService {
  // ----------------------------------------------------
  // Gera a URL que o admin Pool acessa no navegador.
  // (O mesmo link que devolvemos pro admin no chat — mantemos aqui
  // para que /api/wallet/mp-oauth-url também possa devolver isso.)
  // ----------------------------------------------------
  static buildAuthorizationUrl(): string | null {
    if (!env.MP_MARKETPLACE_CLIENT_ID) return null;
    const params = new URLSearchParams({
      client_id: env.MP_MARKETPLACE_CLIENT_ID,
      response_type: "code",
      platform_id: "mp",
      redirect_uri: env.MP_MARKETPLACE_REDIRECT_URI,
    });
    return `https://auth.mercadopago.com.br/authorization?${params.toString()}`;
  }

  // ----------------------------------------------------
  // Troca o `code` recebido no callback pelo access_token + refresh.
  // Persiste em mp_marketplace_credentials com role=pool.
  // ----------------------------------------------------
  static async exchangeCodeAndStore(code: string): Promise<{
    ok: boolean;
    mpUserId?: string;
    expiresAt?: Date;
    error?: string;
  }> {
    if (!env.MP_MARKETPLACE_CLIENT_ID || !env.MP_MARKETPLACE_CLIENT_SECRET) {
      return {
        ok: false,
        error:
          "MP_MARKETPLACE_CLIENT_ID / MP_MARKETPLACE_CLIENT_SECRET não configurados no backend.",
      };
    }

    const body = new URLSearchParams({
      client_id: env.MP_MARKETPLACE_CLIENT_ID,
      client_secret: env.MP_MARKETPLACE_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: env.MP_MARKETPLACE_REDIRECT_URI,
    });

    const res = await fetch(MP_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as any;

    if (!res.ok || !data.access_token) {
      return {
        ok: false,
        error: data?.message || `MP recusou troca de código (HTTP ${res.status}).`,
      };
    }

    const tokenInfo = data as MpOAuthTokenResponse;
    const expiresAt = new Date(Date.now() + tokenInfo.expires_in * 1000);
    const mpUserId = String(tokenInfo.user_id);

    await (prisma as any).mpMarketplaceCredential.upsert({
      where: { accountRole: POOL_ROLE },
      update: {
        mpUserId,
        accessToken: tokenInfo.access_token,
        refreshToken: tokenInfo.refresh_token,
        publicKey: tokenInfo.public_key || null,
        scope: tokenInfo.scope || null,
        expiresAt,
        lastRefreshedAt: new Date(),
      },
      create: {
        accountRole: POOL_ROLE,
        mpUserId,
        accessToken: tokenInfo.access_token,
        refreshToken: tokenInfo.refresh_token,
        publicKey: tokenInfo.public_key || null,
        scope: tokenInfo.scope || null,
        expiresAt,
        lastRefreshedAt: new Date(),
      },
    });

    return { ok: true, mpUserId, expiresAt };
  }

  // ----------------------------------------------------
  // Renova o access_token usando o refresh_token guardado.
  // ----------------------------------------------------
  static async refreshPoolToken(): Promise<{ ok: boolean; error?: string }> {
    if (!env.MP_MARKETPLACE_CLIENT_ID || !env.MP_MARKETPLACE_CLIENT_SECRET) {
      return { ok: false, error: "Credenciais MP Marketplace não configuradas." };
    }

    const cred = await (prisma as any).mpMarketplaceCredential.findUnique({
      where: { accountRole: POOL_ROLE },
    });
    if (!cred) {
      return {
        ok: false,
        error: "Pool ainda não autorizou via OAuth. Rode o link de autorização.",
      };
    }

    const body = new URLSearchParams({
      client_id: env.MP_MARKETPLACE_CLIENT_ID,
      client_secret: env.MP_MARKETPLACE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: cred.refreshToken,
    });

    const res = await fetch(MP_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as any;

    if (!res.ok || !data.access_token) {
      return {
        ok: false,
        error: data?.message || `Falha ao renovar token (HTTP ${res.status}).`,
      };
    }

    const expiresAt = new Date(Date.now() + (data.expires_in || 0) * 1000);
    await (prisma as any).mpMarketplaceCredential.update({
      where: { accountRole: POOL_ROLE },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || cred.refreshToken,
        scope: data.scope || cred.scope,
        expiresAt,
        lastRefreshedAt: new Date(),
      },
    });

    return { ok: true };
  }

  // ----------------------------------------------------
  // Devolve um access_token válido para a Pool. Renova
  // automaticamente se faltar < 30 dias pra expirar.
  // ----------------------------------------------------
  static async getPoolAccessToken(): Promise<{
    token: string | null;
    mpUserId: string | null;
    error?: string;
  }> {
    const cred = await (prisma as any).mpMarketplaceCredential.findUnique({
      where: { accountRole: POOL_ROLE },
    });
    if (!cred) {
      return {
        token: null,
        mpUserId: null,
        error: "Pool não autorizada. Rode o link OAuth pelo menos uma vez.",
      };
    }

    const msToExpiry = cred.expiresAt.getTime() - Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (msToExpiry < THIRTY_DAYS_MS) {
      const refreshed = await this.refreshPoolToken();
      if (!refreshed.ok) {
        // Mesmo com falha de refresh, devolvemos o token atual caso
        // ainda não tenha expirado de verdade — melhor tentar do que
        // travar todas as cobranças.
        if (msToExpiry > 0) {
          return { token: cred.accessToken, mpUserId: cred.mpUserId, error: refreshed.error };
        }
        return {
          token: null,
          mpUserId: null,
          error: refreshed.error || "Token expirado e refresh falhou.",
        };
      }
      const fresh = await (prisma as any).mpMarketplaceCredential.findUnique({
        where: { accountRole: POOL_ROLE },
      });
      return { token: fresh.accessToken, mpUserId: fresh.mpUserId };
    }

    return { token: cred.accessToken, mpUserId: cred.mpUserId };
  }

  // ----------------------------------------------------
  // Diagnóstico para o painel admin.
  // ----------------------------------------------------
  static async getStatus(): Promise<{
    configured: boolean;
    authorized: boolean;
    mpUserId: string | null;
    expiresAt: Date | null;
    lastRefreshedAt: Date | null;
    authorizationUrl: string | null;
  }> {
    const configured = Boolean(
      env.MP_MARKETPLACE_CLIENT_ID && env.MP_MARKETPLACE_CLIENT_SECRET,
    );

    const cred = await (prisma as any).mpMarketplaceCredential.findUnique({
      where: { accountRole: POOL_ROLE },
    });

    return {
      configured,
      authorized: Boolean(cred),
      mpUserId: cred?.mpUserId || null,
      expiresAt: cred?.expiresAt || null,
      lastRefreshedAt: cred?.lastRefreshedAt || null,
      authorizationUrl: configured ? this.buildAuthorizationUrl() : null,
    };
  }
}
