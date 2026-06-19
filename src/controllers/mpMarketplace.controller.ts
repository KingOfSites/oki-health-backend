// OKI 26/05/2026 — endpoints do split MP Marketplace.
// - GET /api/wallet/mp-oauth-url     → devolve link de autorização
// - GET /api/wallet/mp-oauth-callback → recebe ?code= e troca pelo token
// - GET /api/wallet/mp-oauth-status  → diagnóstico para o painel admin
// - POST /api/wallet/mp-oauth-refresh → renova token manualmente

import { Request, Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { MpMarketplaceService } from "../services/mpMarketplace.service";

export class MpMarketplaceController {
  static async getAuthorizationUrl(_req: Request, res: Response) {
    const url = MpMarketplaceService.buildAuthorizationUrl();
    if (!url) {
      return res.status(400).json({
        success: false,
        error:
          "MP_MARKETPLACE_CLIENT_ID não configurado. Configure no Railway antes.",
      });
    }
    return res.json({ success: true, url });
  }

  static async oauthCallback(req: Request, res: Response) {
    try {
      const code = String(req.query.code || "").trim();
      const errorParam = String(req.query.error || "").trim();

      if (errorParam) {
        return res.status(400).send(htmlFeedback({
          ok: false,
          title: "Autorização recusada",
          body: `MP retornou: ${errorParam}. Volte ao link de autorização e aceite os termos.`,
        }));
      }

      if (!code) {
        return res.status(400).send(htmlFeedback({
          ok: false,
          title: "Code ausente",
          body: "O MP não devolveu o parâmetro `code` no callback. Tente novamente.",
        }));
      }

      const result = await MpMarketplaceService.exchangeCodeAndStore(code);
      if (!result.ok) {
        return res.status(400).send(htmlFeedback({
          ok: false,
          title: "Falha na troca de código",
          body: result.error || "Erro desconhecido na troca do code pelo access_token.",
        }));
      }

      return res.status(200).send(htmlFeedback({
        ok: true,
        title: "Conta Pool autorizada com sucesso ✅",
        body:
          `<p>MP User ID da Pool: <code>${result.mpUserId}</code></p>` +
          `<p>Token válido até: <strong>${result.expiresAt?.toLocaleString("pt-BR")}</strong></p>` +
          `<p>O backend já está pronto para criar pagamentos com split automático. Você pode fechar essa aba.</p>`,
      }));
    } catch (err: any) {
      console.error("[MpMarketplace.oauthCallback]", err);
      return res.status(500).send(htmlFeedback({
        ok: false,
        title: "Erro interno",
        body: err?.message || "Falha no callback OAuth.",
      }));
    }
  }

  static async getStatus(req: Request, res: Response) {
    const userId = (req as AuthRequest).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!admin?.isAdmin) {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    }

    const status = await MpMarketplaceService.getStatus();
    return res.json({ success: true, data: status });
  }

  static async refreshToken(req: Request, res: Response) {
    const userId = (req as AuthRequest).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });
    if (!admin?.isAdmin) {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    }

    const result = await MpMarketplaceService.refreshPoolToken();
    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, message: "Token da Pool renovado." });
  }
}

function htmlFeedback({ ok, title, body }: { ok: boolean; title: string; body: string }) {
  const color = ok ? "#3FAE6A" : "#FF6B6B";
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           background:#0a0a0a; color:#fff; min-height:100vh;
           display:flex; align-items:center; justify-content:center; margin:0; padding:20px; }
    .card { max-width: 520px; background:#1a1a1a; border-radius:16px; padding:32px;
            border:1px solid #333; }
    h1 { color: ${color}; margin-top:0; font-size: 20px; }
    p { line-height: 1.5; }
    code { background:#0a0a0a; padding:2px 6px; border-radius:4px; font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body.startsWith("<") ? body : `<p>${body}</p>`}
  </div>
</body>
</html>`;
}
