import { Request, Response } from "express";
import prisma from "../config/database";
import { mpClient } from "../lib/mercadopago";
import { Payment } from "mercadopago";

export class SubscribeController {

  // ------------------------------ CARTÃO ------------------------------
  static async subscribeWithCard(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

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

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado.",
        });
      }

      const planName = planType === "annual" ? "Premium Anual" : "Premium Mensal";

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

      const mpResponse: any = await payment.create({
        body: {
          token,
          transaction_amount,
          installments,
          description,
          payer: {
            email,
            first_name: cardholderName,
            identification: {
              type: "CPF",
              number: "11111111111", // CPF de teste
            },
          },
        },
      });

      if (!["approved", "pending", "in_process"].includes(mpResponse.status)) {
        return res.status(400).json({
          success: false,
          message: "Falha no pagamento.",
          error: mpResponse,
        });
      }

      // Desativa assinatura antiga
      await prisma.planSubscription.updateMany({
        where: { userId },
        data: { active: false },
      });

      const now = new Date();
      const endDate =
        planType === "annual"
          ? new Date(now.setFullYear(now.getFullYear() + 1))
          : new Date(now.setMonth(now.getMonth() + 1));

      // Cria assinatura
      const subscription = await prisma.planSubscription.upsert({
        where: { userId },
        update: {
          planId: plan.id,
          active: true,
          startDate: new Date(),
          endDate,
        },
        create: {
          userId,
          planId: plan.id,
          active: true,
          startDate: new Date(),
          endDate,
        },
      });

      // Registra transação
      await prisma.transaction.create({
        data: {
          amount: plan.price,
          type: "subscription",
          description: `Plano Premium ${planType}`,
          user: { connect: { id: userId } },
        },
      });

      return res.json({
        success: true,
        message: "Assinatura criada com sucesso!",
        subscription,
      });

    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Erro ao processar assinatura.",
        details: error.message,
      });
    }
  }

  // ------------------------------ PIX ------------------------------
  static async subscribeWithPix(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { planType, cpf } = req.body;

      if (!userId || !planType || !cpf) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos para gerar PIX.",
        });
      }

      const planName = planType === "annual" ? "Premium Anual" : "Premium Mensal";

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

      const mpPix: any = await payment.create({
        body: {
          transaction_amount: plan.price,
          description: `Assinatura ${planName}`,
          payment_method_id: "pix",
          payer: {
            email: "cliente@example.com",
            first_name: "Cliente",
            identification: {
              type: "CPF",
              number: cpf.replace(/\D/g, ""),
            },
          },
        },
      });

      console.log("PIX RESPONSE:", mpPix);

      return res.json({
        success: true,
        qrCode: mpPix.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64:
          mpPix.point_of_interaction?.transaction_data?.qr_code_base64,
        expiration: mpPix.date_of_expiration,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar PIX.",
        details: error.message,
      });
    }
  }

  // ------------------------------ STATUS PREMIUM ------------------------------
  static async getStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const subscription = await prisma.planSubscription.findFirst({
        where: {
          userId,
          active: true,
          endDate: { gte: new Date() }
        },
        include: { plan: true }
      });

      return res.json({
        premium: Boolean(subscription),
        plan: subscription?.plan?.name ?? null,
        expiresAt: subscription?.endDate ?? null
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Erro ao verificar assinatura."
      });
    }
  }
}
