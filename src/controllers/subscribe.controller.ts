import { Request, Response } from "express";
import prisma from "../config/database";
import { mpClient } from "../lib/mercadopago";
import { Payment } from "mercadopago";

export class SubscribeController {
  static async subscribeWithCard(req: Request, res: Response) {
    try {
      const userId = (req as any).userId; // <-- garante que nunca dá undefined

      const {
        token,
        planType,
        email,
        cardholderName,
      } = req.body;

      console.log("REQ.BODY RECEBIDO:", req.body);
      console.log("USER ID EXTRAÍDO:", userId);

      // ❌ userId NÃO entra mais na validação porque pode vir undefined
      if (!token || !planType || !email || !cardholderName) {
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

      // Seleção do plano
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

      // Pagamento sem CPF — apenas email e nome
      const result: any = await payment.create({
        body: {
          token,
          transaction_amount: plan.price,
          installments: 1,
          description: `Assinatura ${planName}`,
          payer: {
            email,
            first_name: cardholderName,
          },
        },
      });

      console.log("MP RESULT RECEBIDO:", result);

      if (
        result.status !== "approved" &&
        result.status !== "in_process" &&
        result.status !== "pending"
      ) {
        return res.status(400).json({
          success: false,
          message: "Falha no pagamento.",
          error: result,
        });
      }

      // Desativa assinaturas ativas anteriores
      await prisma.planSubscription.updateMany({
        where: { userId },
        data: { active: false },
      });

      // Calcula nova validade
      const now = new Date();
      const endDate =
        planType === "annual"
          ? new Date(now.setFullYear(now.getFullYear() + 1))
          : new Date(now.setMonth(now.getMonth() + 1));

      // Cria assinatura ou atualiza se já existir
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

      // Cria registro de transação
      await prisma.transaction.create({
        data: {
          user_id: userId,
          amount: plan.price,
          type: "subscription",
          description: `Pagamento da assinatura ${planName}`,
        },
      });

      return res.json({
        success: true,
        message: "Assinatura criada com sucesso!",
        subscription,
      });

    } catch (error: any) {
      console.error("SUBSCRIBE ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar assinatura",
        details: error?.message,
      });
    }
  }
}
