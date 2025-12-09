import prisma from "../config/database";

export class SubscribeService {
  static async activatePremium(userId: string, planType: "monthly" | "annual") {
    const expires = new Date();
    expires.setMonth(expires.getMonth() + (planType === "annual" ? 12 : 1));

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "PREMIUM",
      },
    });

    await prisma.planSubscription.upsert({
      where: { userId },
      update: {
        planId: "premium",
        endDate: expires,
        active: true
      },
      create: {
        userId,
        planId: "premium",
        endDate: expires,
        active: true
      }
    });
  }
}
