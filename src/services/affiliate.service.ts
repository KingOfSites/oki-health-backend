import prisma from "../config/database";

export class AffiliateService {
  // Gerar código de afiliado único (usando parte do UUID)
  static generateAffiliateCode(): string {
    return require("crypto").randomUUID().substring(0, 8).toUpperCase();
  }

  // Obter estatísticas do afiliado
  static async getAffiliateStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        affiliateCode: true,
      },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Contar indicações totais
    const totalReferrals = await prisma.user.count({
      where: { referredBy: userId },
    });

    // Contar indicações ativas (que têm assinatura premium)
    const activeReferrals = await prisma.user.count({
      where: {
        referredBy: userId,
        planSubscription: {
          active: true,
        },
      },
    });

    // Calcular ganhos totais
    const totalEarnings = await prisma.referral.aggregate({
      where: {
        referrerId: userId,
        status: { in: ["pending", "paid"] },
      },
      _sum: {
        commission: true,
      },
    });

    // Ganhos já pagos
    const paidEarnings = await prisma.referral.aggregate({
      where: {
        referrerId: userId,
        status: "paid",
      },
      _sum: {
        commission: true,
      },
    });

    // Garantir que o usuário tenha código de afiliado
    const affiliateCode = user.affiliateCode || await this.getOrCreateAffiliateCode(userId);

    return {
      affiliateCode,
      totalReferrals,
      activeReferrals,
      totalEarnings: totalEarnings._sum.commission || 0,
      paidEarnings: paidEarnings._sum.commission || 0,
      pendingEarnings: (totalEarnings._sum.commission || 0) - (paidEarnings._sum.commission || 0),
    };
  }

  // Obter ou gerar código de afiliado
  static async getOrCreateAffiliateCode(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { affiliateCode: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Se não tiver código, gerar um
    if (!user.affiliateCode) {
      let newCode: string;
      let exists = true;
      
      // Garantir que o código seja único
      while (exists) {
        newCode = this.generateAffiliateCode();
        const existing = await prisma.user.findUnique({
          where: { affiliateCode: newCode },
        });
        exists = !!existing;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { affiliateCode: newCode },
      });

      return newCode;
    }

    return user.affiliateCode;
  }

  // Obter link de afiliado
  static async getAffiliateLink(userId: string, baseUrl: string = "https://oki.health") {
    const affiliateCode = await this.getOrCreateAffiliateCode(userId);
    return `${baseUrl}/convite/${affiliateCode}`;
  }

  // Registrar referral no signup
  static async registerReferral(referredUserId: string, affiliateCode: string) {
    // Encontrar o usuário que fez a indicação
    const referrer = await prisma.user.findUnique({
      where: { affiliateCode: affiliateCode },
    });

    if (!referrer) {
      return null; // Código inválido, mas não é erro
    }

    // Não permitir auto-referral
    if (referrer.id === referredUserId) {
      return null;
    }

    // Atualizar o usuário indicado
    await prisma.user.update({
      where: { id: referredUserId },
      data: { referredBy: referrer.id },
    });

    // Criar registro de referral (comissão será calculada quando houver conversão)
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredUserId: referredUserId,
        commission: 0, // Será calculado quando houver conversão
        commissionRate: 0.1, // 10%
        status: "pending",
        source: "signup",
      },
    });

    return referral;
  }

  // Registrar código de afiliado para usuário já cadastrado
  static async registerAffiliateCode(userId: string, affiliateCode: string) {
    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredBy: true },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Verificar se o usuário já tem um referrer
    if (user.referredBy) {
      throw new Error("Você já está vinculado a um afiliado");
    }

    // Encontrar o usuário que fez a indicação
    const referrer = await prisma.user.findUnique({
      where: { affiliateCode: affiliateCode.toUpperCase().trim() },
    });

    if (!referrer) {
      throw new Error("Código de afiliado inválido");
    }

    // Não permitir auto-referral
    if (referrer.id === userId) {
      throw new Error("Você não pode usar seu próprio código");
    }

    // Atualizar o usuário indicado
    await prisma.user.update({
      where: { id: userId },
      data: { referredBy: referrer.id },
    });

    // Verificar se já existe um referral para evitar duplicatas
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referrerId: referrer.id,
        referredUserId: userId,
      },
    });

    if (!existingReferral) {
      // Criar registro de referral (comissão será calculada quando houver conversão)
      await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredUserId: userId,
          commission: 0, // Será calculado quando houver conversão
          commissionRate: 0.1, // 10%
          status: "pending",
          source: "manual",
        },
      });
    }

    return { success: true, message: "Código de afiliado registrado com sucesso" };
  }

  // Calcular comissão quando alguém assina premium
  static async calculateCommissionForSubscription(referredUserId: string, subscriptionAmount: number) {
    const referredUser = await prisma.user.findUnique({
      where: { id: referredUserId },
      select: { referredBy: true },
    });

    if (!referredUser || !referredUser.referredBy) {
      return null; // Não foi indicado por ninguém
    }

    // Taxa de comissão padrão: 10% do valor da assinatura
    const commissionRate = 0.1;
    const commission = subscriptionAmount * commissionRate;

    // Atualizar ou criar referral com comissão
    const referral = await prisma.referral.findFirst({
      where: {
        referrerId: referredUser.referredBy,
        referredUserId: referredUserId,
        source: "subscription",
      },
    });

    if (referral) {
      // Atualizar comissão existente
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          commission,
          status: "pending",
        },
      });
    } else {
      // Criar novo registro de comissão
      await prisma.referral.create({
        data: {
          referrerId: referredUser.referredBy,
          referredUserId: referredUserId,
          commission,
          commissionRate,
          status: "pending",
          source: "subscription",
        },
      });
    }

    // Atualizar saldo do afiliado
    await prisma.user.update({
      where: { id: referredUser.referredBy },
      data: {
        balance: {
          increment: commission,
        },
        total_earned: {
          increment: commission,
        },
      },
    });

    // Criar transação
    await prisma.transaction.create({
      data: {
        userId: referredUser.referredBy,
        type: "affiliate_commission",
        amount: commission,
      },
    });

    return commission;
  }
}

