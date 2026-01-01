import { MercadoPagoConfig } from "mercadopago";

const mpAccessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;

// BLOQUEAR tokens de teste - APENAS PRODUÇÃO PERMITIDA
if (mpAccessToken && mpAccessToken.startsWith("TEST-")) {
  console.error("❌ [Mercado Pago Client] ERRO: Token de TESTE detectado!");
  console.error("   ⚠️  APENAS tokens de PRODUÇÃO são permitidos neste sistema!");
  console.error("   Configure MP_ACCESS_TOKEN com token de PRODUÇÃO (começa com APP_USR-)");
  throw new Error("Token de teste não permitido. Use apenas token de produção.");
}

if (!mpAccessToken) {
  console.error("❌ [Mercado Pago Client] MP_ACCESS_TOKEN não configurado!");
}

export const mpClient = new MercadoPagoConfig({
  accessToken: mpAccessToken || "",
});
