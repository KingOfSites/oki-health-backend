import prisma from "../config/database";

export class SubscribeService {
  static async activatePremium(userId: string, planType: "monthly" | "annual") {
    const expires = new Date();

    expires.setMonth(
      expires.getMonth() + (planType === "annual" ? 12 : 1)
    );

    // ❌ Removido: campo "plan" não existe no Prisma
    // await prisma.user.update({ ... })

    // Encontrar plano correto:
    const planName = planType === "annual" ? "Premium Anual" : "Premium Mensal";
    const plan = await prisma.plan.findFirst({ where: { name: planName } });

    if (!plan) throw new Error("Plano não encontrado");

    await prisma.planSubscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        endDate: expires,
        active: true,
      },
      create: {
        userId,
        planId: plan.id,
        endDate: expires,
        active: true,
      },
    });

    return true;
  }
}
