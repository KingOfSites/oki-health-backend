import prisma from "../config/database";

export class ChallengesService {

  // ================================
  // 1 — MEUS DESAFIOS
  // ================================
  static async listMyChallenges(userId: string) {
    return prisma.challengeParticipant.findMany({
      where: { userId },
      include: { challenge: true },
    });
  }

  // ================================
  // 2 — DESAFIOS CRIADOS POR MIM
  // ================================
  static async listCreatedChallenges(userId: string) {
    return prisma.challenge.findMany({
      where: { createdById: userId },
      include: { participants: true },
    });
  }

  // ================================
  // 3 — CRIAR DESAFIO
  // ================================
  static async createChallenge(data: any) {
    return prisma.challenge.create({ data });
  }

  // ================================
  // 4 — BUSCAR DESAFIOS
  // ================================
  static async searchChallenges(location: string) {
    return prisma.challenge.findMany({
      where: {
        location: {
          contains: location.toLowerCase(),
        },
      },
      include: { participants: true },
    });
  }

  // ================================
  // 5 — ENTRAR EM UM DESAFIO (CORRIGIDO)
  // ================================
  static async joinChallenge(userId: string, challengeId: string) {
    const [user, challenge] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.challenge.findUnique({ where: { id: challengeId } }),
    ]);

    if (!user || !challenge) {
      throw new Error("Usuário ou desafio não encontrado");
    }

    // 1️⃣ Verifica se já participa
    const already = await prisma.challengeParticipant.findFirst({
      where: { userId, challengeId },
    });

    if (already) {
      return {
        already: true,
        requiresPayment: false,
        participant: already,
      };
    }

    const price = challenge.entryPriceCents || 0;

    // 🔥 2️⃣ Se o desafio é pago, verifique se o pagamento JÁ FOI FEITO
    if (price > 0) {
      const approvedPayment = await prisma.transaction.findFirst({
        where: {
          userId,
          challengeId,
          type: "challenge_entry",
          status: "approved",     // ⬅ IMPORTANTE!
        },
      });

      // Se NÃO existe pagamento aprovado → cobrar
      if (!approvedPayment) {
        return {
          already: false,
          requiresPayment: true,
          price,
          message: "Pagamento necessário para entrar no desafio.",
        };
      }
    }

    // 3️⃣ Criar participação (caso já tenha pago ou seja gratis)
    const participant = await prisma.challengeParticipant.create({
      data: {
        userId,
        challengeId,
        progress: 0,
      },
    });

    return {
      already: false,
      requiresPayment: false,
      participant,
    };
  }

  // ================================
  // 6 — DETALHES DO DESAFIO
  // ================================
  static async getDetails(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        participants: true,
        createdBy: true,
      },
    });

    if (!challenge) return null;

    const isParticipant = challenge.participants.some(p => p.userId === userId);

    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      category: challenge.category,
      start_date: challenge.startDate,
      end_date: challenge.endDate,
      location: challenge.location,
      entry_price_cents: challenge.entryPriceCents,
      reward: challenge.reward,
      participants_count: challenge.participants.length,
      is_creator: challenge.createdById === userId,
      is_participant: isParticipant,
      status: challenge.status,
    };
  }

  // ================================
  // 7 — EXCLUIR DESAFIO
  // ================================
  static async deleteChallenge(id: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id },
    });

    if (!challenge || challenge.createdById !== userId) return false;

    await prisma.challenge.delete({ where: { id } });
    return true;
  }

  // ================================
  // 8 — FINALIZAR DESAFIO + DEPOSITAR PRÊMIO
  // ================================
  static async completeChallenge(userId: string, challengeId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error("Desafio não encontrado");
    }

    const participant = await prisma.challengeParticipant.findFirst({
      where: { userId, challengeId },
    });

    if (!participant) {
      throw new Error("Você não está inscrito neste desafio.");
    }

    if (participant.progress >= 100) {
      return {
        success: true,
        message: "Desafio já foi concluído anteriormente.",
      };
    }

    await prisma.challengeParticipant.update({
      where: { id: participant.id },
      data: { progress: 100 },
    });

    const reward = challenge.reward || 0;

    if (reward > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: reward },
          total_earned: { increment: reward },
        },
      });

      await prisma.transaction.create({
        data: {
          userId,
          amount: reward,
          type: "reward",
        },
      });
    }

    return {
      success: true,
      message: "Desafio concluído! Prêmio depositado na carteira.",
      reward,
    };
  }
}
