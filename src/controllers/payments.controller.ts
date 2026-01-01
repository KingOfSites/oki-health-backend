import { Request, Response } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";

const mpAccessToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;

// BLOQUEAR tokens de teste - APENAS PRODUÇÃO PERMITIDA
if (mpAccessToken && mpAccessToken.startsWith("TEST-")) {
  console.error("❌ [Payments Controller] ERRO: Token de TESTE detectado!");
  console.error("   ⚠️  APENAS tokens de PRODUÇÃO são permitidos neste sistema!");
  throw new Error("Token de teste não permitido. Use apenas token de produção.");
}

const mpClient = new MercadoPagoConfig({
  accessToken: mpAccessToken || "",
});

export class PaymentsController {
  static async payWithCard(req: Request, res: Response) {
    try {
      const { token, amount, cardholderName, email, cpf } = req.body;

      if (!token || !amount || !email || !cpf) {
        return res.status(400).json({
          success: false,
          message: "Dados incompletos para pagamento.",
        });
      }

      const payment = new Payment(mpClient);

      const result = await payment.create({
        body: {
          transaction_amount: Number(amount),
          description: "Assinatura Oki Premium",
          token,

          // ⚠️ NÃO DEFINIR payment_method_id MANUALMENTE
          // O Mercado Pago identifica sozinho pelo BIN do cartão

          payer: {
            email,
            first_name: cardholderName,
            identification: {
              type: "CPF",
              number: cpf, // AGORA VEM DO CLIENTE
            },
          },

          installments: 1,
        },
      });

      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("MP Error:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar pagamento",
        error: error?.message,
      });
    }
  }
}
