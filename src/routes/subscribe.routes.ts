import { Router } from "express";
import prisma from "../config/database";

const router = Router();

/**
 * 🎯 POST /api/subscribe/confirm
 * Ativa a assinatura do usuário após pagamento
 */
router.post("/confirm", async (req, res) => {
  try {
    const { userId, planType } = req.body;

    if (!userId || !planType) {
      return res.status(400).json({ message: "Dados inválidos" });
    }

    const planName =
      planType === "annual" ? "Premium Anual" : "Premium Mensal";

    // Busca o plano no banco
    const plan = await prisma.plan.findFirst({
      where: { name: planName },
    });

    if (!plan) {
      return res.status(404).json({ message: "Plano não encontrado." });
    }

    // Desativa assinaturas anteriores
    await prisma.planSubscription.updateMany({
      where: { userId },
      data: { active: false },
    });

    // Calcula nova data de expiração
    const now = new Date();
    const endDate =
      planType === "annual"
        ? new Date(now.setFullYear(now.getFullYear() + 1))
        : new Date(now.setMonth(now.getMonth() + 1));

    // Cria assinatura nova
    // Upsert da assinatura do usuário
    const subscription = await prisma.planSubscription.upsert({
      where: {
        userId: userId,
      },
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


    return res.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("SUBSCRIBE CONFIRM ERROR:", error);
    return res.status(500).json({ message: "Erro ao confirmar assinatura." });
  }
});

/**
 * 🎯 GET /api/subscribe/status/:userId
 * Retorna se o usuário é premium ou não
 */
router.get("/status/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const subscription = await prisma.planSubscription.findFirst({
      where: {
        userId,
        active: true,
        endDate: { gte: new Date() }, // assinatura válida
      },
      include: {
        plan: true,
      },
    });

    return res.json({
      premium: Boolean(subscription),
      plan: subscription?.plan?.name || null,
      expiresAt: subscription?.endDate || null,
    });
  } catch (error) {
    console.error("SUBSCRIPTION STATUS ERROR:", error);
    return res
      .status(500)
      .json({ error: "Erro ao verificar status da assinatura." });
  }
});

export default router;
