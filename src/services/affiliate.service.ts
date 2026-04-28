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
      let newCode: string = "";
      let exists = true;
      let attempts = 0;
      
      // Garantir que o código seja único
      while (exists && attempts < 100) {
        newCode = this.generateAffiliateCode();
        const existing = await prisma.user.findUnique({
          where: { affiliateCode: newCode },
        });
        exists = !!existing;
        attempts++;
      }

      if (!newCode) {
        throw new Error("Não foi possível gerar código de afiliado único");
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
    // Encontrar o usuário que fez a indicação (apenas id para evitar referências circulares)
    const referrer = await prisma.user.findUnique({
      where: { affiliateCode: affiliateCode },
      select: { id: true },
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
        commissionRate: 0.15, // 15%
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

    // Encontrar o usuário que fez a indicação (apenas id para evitar referências circulares)
    const referrer = await prisma.user.findUnique({
      where: { affiliateCode: affiliateCode.toUpperCase().trim() },
      select: { id: true },
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
          commissionRate: 0.15, // 15%
          status: "pending",
          source: "manual",
        },
      });
    }

    return { success: true, message: "Código de afiliado registrado com sucesso" };
  }

  // Calcular comissão para um pagamento convertido (assinatura, entrada em desafio, etc.)
  static async calculateCommissionForPayment(referredUserId: string, amount: number, source: string) {
    const referredUser = await prisma.user.findUnique({
      where: { id: referredUserId },
      select: { referredBy: true },
    });

    if (!referredUser || !referredUser.referredBy) {
      return null; // Não foi indicado por ninguém
    }

    // Taxa de comissão padrão: 15%
    const commissionRate = 0.15;
    const commission = amount * commissionRate;

    // Atualizar ou criar referral com comissão
    const referral = await prisma.referral.findFirst({
      where: {
        referrerId: referredUser.referredBy,
        referredUserId: referredUserId,
        source,
      },
    });

    if (referral) {
      // Atualizar comissão existente
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          commission,
          status: "pending",
          commissionRate,
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
          source,
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
        status: "completed",
        description: `Comissão de afiliado (${source})`,
      },
    });

    return commission;
  }

  // Compat: assinatura premium
  static async calculateCommissionForSubscription(referredUserId: string, subscriptionAmount: number) {
    return this.calculateCommissionForPayment(referredUserId, subscriptionAmount, "subscription");
  }

  // Listar todas as indicações (referrals) do afiliado
  static async getReferrals(userId: string, filters?: { status?: string; source?: string; limit?: number; offset?: number }) {
    const where: any = {
      referrerId: userId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.source) {
      where.source = filters.source;
    }

    // Buscar referrals sem include para evitar referências circulares
    const referrals = await prisma.referral.findMany({
      where,
      select: {
        id: true,
        referrerId: true,
        referredUserId: true,
        commission: true,
        commissionRate: true,
        status: true,
        source: true,
        created_at: true,
        paid_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });

    // Buscar informações dos usuários indicados
    const referralsWithUserInfo = await Promise.all(
      referrals.map(async (referral) => {
        const referredUser = await prisma.user.findUnique({
          where: { id: referral.referredUserId },
          select: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            created_at: true,
            planSubscription: {
              select: {
                active: true,
                plan: {
                  select: {
                    name: true,
                    price: true,
                  },
                },
              },
            },
          },
        });

        return {
          id: referral.id,
          referredUser: referredUser || null,
          commission: referral.commission,
          commissionRate: referral.commissionRate,
          status: referral.status,
          source: referral.source,
          created_at: referral.created_at,
          paid_at: referral.paid_at,
        };
      })
    );

    const total = await prisma.referral.count({ where });

    return {
      referrals: referralsWithUserInfo,
      total,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
    };
  }

  // Obter histórico de pagamentos
  static async getPaymentHistory(userId: string, limit: number = 20, offset: number = 0) {
    // Buscar sem include para evitar referências circulares
    const paidReferrals = await prisma.referral.findMany({
      where: {
        referrerId: userId,
        status: "paid",
      },
      select: {
        id: true,
        referrerId: true,
        referredUserId: true,
        commission: true,
        paid_at: true,
        source: true,
      },
      orderBy: {
        paid_at: "desc",
      },
      take: limit,
      skip: offset,
    });

    const referralsWithUserInfo = await Promise.all(
      paidReferrals.map(async (referral) => {
        const referredUser = await prisma.user.findUnique({
          where: { id: referral.referredUserId },
          select: {
            name: true,
            email: true,
          },
        });

        return {
          id: referral.id,
          referredUser: referredUser || null,
          commission: referral.commission,
          paid_at: referral.paid_at,
          source: referral.source,
        };
      })
    );

    const total = await prisma.referral.count({
      where: {
        referrerId: userId,
        status: "paid",
      },
    });

    return {
      payments: referralsWithUserInfo,
      total,
      limit,
      offset,
    };
  }

  // Obter estatísticas detalhadas (últimos 30 dias, etc)
  static async getDetailedStats(userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Referrals dos últimos 30 dias
    const recentReferrals = await prisma.referral.count({
      where: {
        referrerId: userId,
        created_at: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Ganhos dos últimos 30 dias
    const recentEarnings = await prisma.referral.aggregate({
      where: {
        referrerId: userId,
        created_at: {
          gte: thirtyDaysAgo,
        },
        status: { in: ["pending", "paid"] },
      },
      _sum: {
        commission: true,
      },
    });

    // Taxa de conversão (usuários com premium / total de referrals)
    const totalReferrals = await prisma.user.count({
      where: { referredBy: userId },
    });

    const conversions = await prisma.user.count({
      where: {
        referredBy: userId,
        planSubscription: {
          active: true,
        },
      },
    });

    const conversionRate = totalReferrals > 0 ? (conversions / totalReferrals) * 100 : 0;

    // Ganhos por fonte
    const earningsBySource = await prisma.referral.groupBy({
      by: ["source"],
      where: {
        referrerId: userId,
        status: { in: ["pending", "paid"] },
      },
      _sum: {
        commission: true,
      },
    });

    return {
      recentReferrals,
      recentEarnings: recentEarnings._sum.commission || 0,
      conversionRate: Math.round(conversionRate * 100) / 100,
      earningsBySource: earningsBySource.map((item) => ({
        source: item.source || "unknown",
        total: item._sum.commission || 0,
      })),
    };
  }
}

