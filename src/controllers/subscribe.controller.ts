import { prisma } from "../lib/prisma";

export const confirmSubscription = async (req: any, res: any) => {
  try {
    const { userId, planType } = req.body;

    if (!userId || !planType) {
      return res.status(400).json({ message: "Dados inválidos" });
    }

    const planName =
      planType === "annual" ? "Premium Anual" : "Premium Mensal";

    const plan = await prisma.plan.findFirst({
      where: { name: planName },
    });

    if (!plan) {
      return res.status(404).json({ message: "Plano não encontrado." });
    }

    // Desativa assinatura antiga
    await prisma.planSubscription.updateMany({
      where: { userId },
      data: { active: false },
    });

    // Registra nova assinatura
    const subscription = await prisma.planSubscription.create({
      data: {
        userId,
        planId: plan.id,
        active: true,
        startDate: new Date(),
        endDate:
          planType === "annual"
            ? new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            : new Date(new Date().setMonth(new Date().getMonth() + 1)),
      },
    });

    return res.json({ success: true, subscription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao criar assinatura" });
  }
};
