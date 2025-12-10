import { Request, Response } from "express";
import prisma from "../config/database";
import { mpClient } from "../lib/mercadopago";
import { Payment } from "mercadopago";

export class SubscribeController {
  // ---------------------------------------------------------
  // 🔥 Assinatura via Cartão
  // ---------------------------------------------------------
  static async subscribeWithCard(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado.",
        });
      }

      const {
        token,
        planType,
        email,
        cardholderName,
        transaction_amount,
        installments,
        description,
      } = req.body;

      if (!token || !transaction_amount || !email || !planType) {
        return res.status(400).json({
          success: false,
          message: "Dados incompletos para pagamento.",
        });
      }

      const planName =
        planType === "annual" ? "Premium Anual" : "Premium Mensal";

      const plan = await prisma.plan.findFirst({
        where: { name: planName },
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Plano não encontrado.",
        });
      }

      const payment = new Payment(mpClient);

      // 🔥 CORRIGIDO — REMOVIDO PaymentCreateResponse
      const mpResponse: any = await payment.create({
        body: {
          token,
          transaction_amount,
          installments,
          description: description ?? `Assinatura ${planName}`,
          payer: {
            email,
            first_name: cardholderName,
            identification: {
              type: "CPF",
              number: "11111111111",
            },
          },
        },
      });

      console.log("🧾 MP RESPONSE:", mpResponse);

      if (
        !["approved", "pending", "in_process"].includes(
          mpResponse.status ?? ""
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Falha no pagamento.",
          error: mpResponse,
        });
      }

      // Desativa assinaturas anteriores
      await prisma.planSubscription.updateMany({
        where: { userId },
        data: { active: false },
      });

      const startDate = new Date();
      const endDate =
        planType === "annual"
          ? new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate())
          : new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());

      // Cria ou atualiza assinatura
      const subscription = await prisma.planSubscription.upsert({
        where: { userId },
        update: {
          planId: plan.id,
          active: true,
          startDate,
          endDate,
        },
        create: {
          userId,
          planId: plan.id,
          active: true,
          startDate,
          endDate,
        },
      });

      // Registro da transação
      await prisma.transaction.create({
        data: {
          userId,
          amount: transaction_amount,
          type: "subscription",
          description: description ?? `Assinatura ${planName}`,
        },
      });

      return res.json({
        success: true,
        message: "Assinatura criada com sucesso!",
        subscription,
      });

    } catch (error: any) {
      console.error("❌ ERRO EM ASSINATURA:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar assinatura.",
        details: error.message,
      });
    }
  }
}
