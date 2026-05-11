import prisma from "../config/database";

export class SubscribeService {
  static async activatePremium(userId: string, planType: "monthly" | "annual") {
    const expires = new Date();

    expires.setMonth(
      expires.getMonth() + (planType === "annual" ? 12 : 1)
    );

    // ❌ Removido: campo "plan" não existe no Prisma
    // await prisma.user.update({ ... })

    // PDF (Maio/2026 #9): apenas o plano "Premium" existe (sem variações
    // mensal/anual nomeadas separadamente — a duração é tratada via endDate).
    const plan = await prisma.plan.findFirst({ where: { name: "Premium" } });

    if (!plan) throw new Error("Plano Premium não encontrado");

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

    // Calcular comissão de afiliado se o usuário foi indicado
    try {
      const { AffiliateService } = await import("./affiliate.service");
      await AffiliateService.calculateCommissionForPayment(userId, plan.price, "subscription");
    } catch (error) {
      // Não falhar a assinatura se houver erro no cálculo de comissão
      console.error("Erro ao calcular comissão de afiliado:", error);
    }

    return true;
  }
}
