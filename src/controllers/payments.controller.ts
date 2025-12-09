import { Request, Response } from "express";
import { Payment } from "mercadopago";
import { mpClient } from "../lib/mercadopago";

export class PaymentsController {
  static async payWithCard(req: Request, res: Response) {
    try {
      const { token, amount, cardholderName, email } = req.body;

      if (!token || !amount || !email) {
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

          // 👇 Mercado Pago identifica automaticamente o método (visa/master/etc)
          payment_method_id: "credit_card",

          payer: {
            email,
            first_name: cardholderName,
            identification: {
              type: "CPF",
              number: "12345678909",
            },
          },

          installments: 1, // pagamento à vista (padrão)
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
