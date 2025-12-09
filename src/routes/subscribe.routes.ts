import { Router } from "express";
import prisma from "../config/database";
import { PaymentsController } from "../controllers/payments.controller";

const router = Router();

/**
 * 🔥 1) pagamento com cartão (Mercado Pago)
 */
router.post("/card", PaymentsController.payWithCard);

/**
 * 🔥 2) confirmar assinatura no banco
 * é chamado DEPOIS que o pagamento foi aprovado
 */
router.post("/confirm", async (req, res) => {
  try {
    const { userId, planType } = req.body;

    if (!userId || !planType) {
      return res.status(400).json({ success: false, message: "Dados inválidos" });
    }

    const planChosen = planType === "annual" ? "Premium Anual" : "Premium Mensal";

    const plan = await prisma.plan.findFirst({
      where: { name: planChosen }
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plano não encontrado" });
    }

    // 🔥 Desativa assinaturas antigas
    await prisma.planSubscription.updateMany({
      where: { userId },
      data: { active: false }
    });

    // 🔥 Calcula validade
    const startDate = new Date();
    const endDate = new Date();

    if (planType === "annual") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // 🔥 Sobe ou cria assinatura ativa
    const subscription = await prisma.planSubscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        active: true,
        startDate,
        endDate
      },
      create: {
        userId,
        planId: plan.id,
        active: true,
        startDate,
        endDate
      }
    });

    // 🔥 Registra transação do usuário
    await prisma.transaction.create({
      data: {
        userId,
        amount: plan.price,
        type: "subscription",
        description: `Pagamento da assinatura ${planChosen}`
      }
    });

    return res.json({
      success: true,
      message: "Assinatura confirmada com sucesso!",
      subscription
    });

  } catch (error) {
    console.error("SUBSCRIBE CONFIRM ERROR:", error);
    return res.status(500).json({ success: false, message: "Erro ao confirmar assinatura." });
  }
});

/**
 * 🔥 3) verificar status premium
 */
router.get("/status/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
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
    console.error("SUBSCRIPTION STATUS ERROR:", error);
    return res.status(500).json({ success: false, message: "Erro ao verificar assinatura." });
  }
});

export default router;
