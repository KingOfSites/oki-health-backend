import prisma from "../config/database";

export class ChallengesService {

  // ================================
  // 1 — MEUS DESAFIOS
  // ================================
  static async listMyChallenges(userId: string) {
    return prisma.challengeParticipant.findMany({
      where: { userId },
      include: { challenge: true },
      orderBy: { joinedAt: "desc" },
    });

    const ids = rows.map(r => r.challengeId);

    const counts = await prisma.challengeParticipant.groupBy({
      by: ["challengeId"],
      _count: { challengeId: true },
      where: { challengeId: { in: ids } },
    });

    const countMap = new Map(
      counts.map(c => [c.challengeId, c._count.challengeId])
    );

    return rows.map(r => {
      // Calcular status baseado nas datas
      const now = new Date();
      let computed_status: "upcoming" | "active" | "completed";
      if (now < r.challenge.startDate) computed_status = "upcoming";
      else if (now > r.challenge.endDate) computed_status = "completed";
      else computed_status = "active";

      return {
        id: r.challenge.id,
        title: r.challenge.title,
        description: r.challenge.description,
        type: r.challenge.category,
        status: computed_status,
        start_date: r.challenge.startDate,
        end_date: r.challenge.endDate,
        participants_count: countMap.get(r.challenge.id) || 0,
        progress: r.progress,
        cover_url: r.challenge.coverUrl || null,
        entry_price_cents: r.challenge.entryPriceCents,
        is_creator: r.challenge.createdById === userId,
        is_participant: true,
      };
    });
  }

  // --------------------------------
  // DESAFIOS CRIADOS POR MIM
  // --------------------------------
  static async listCreatedChallenges(userId: string) {
    return prisma.challenge.findMany({
      where: { createdById: userId },
      include: { participants: true },
    });

    const counts = await prisma.challengeParticipant.groupBy({
      by: ["challengeId"],
      _count: { challengeId: true },
      where: { challengeId: { in: rows.map(c => c.id) } },
    });

    const countMap = new Map(
      counts.map(c => [c.challengeId, c._count.challengeId])
    );

    return rows.map(c => {
      // Calcular status baseado nas datas
      const now = new Date();
      let computed_status: "upcoming" | "active" | "completed";
      if (now < c.startDate) computed_status = "upcoming";
      else if (now > c.endDate) computed_status = "completed";
      else computed_status = "active";

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        type: c.category,
        status: computed_status,
        start_date: c.startDate,
        end_date: c.endDate,
        participants_count: countMap.get(c.id) || 0,
        cover_url: c.coverUrl,
        entry_price_cents: c.entryPriceCents,
        is_creator: true,
        is_participant: true,
      };
    });
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
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.category,
        status: computed_status, // Usa o status calculado
        start_date: challenge.startDate,
        end_date: challenge.endDate,
        entry_price_cents: challenge.entryPriceCents,
        cover_url: challenge.coverUrl,
        participants_count,
        rules: null,
        computed_status,
        is_creator,
        is_participant,
      },
      posts,
      ranking,
      chat: [],
    };
  }

  // --------------------------------
  // LISTA TODOS OS DESAFIOS (HOME / EXPLORAR)
  // --------------------------------
  static async listAllChallenges(userId: string) {
    const challenges = await prisma.challenge.findMany({
      // Removido where: { status: "active" } pois status não existe no schema
      orderBy: { created_at: "desc" },
      include: {
        participants: true,
      },
    });

    return challenges.map(c => {
      // Calcular status baseado nas datas
      const now = new Date();
      let computed_status: "upcoming" | "active" | "completed";
      if (now < c.startDate) computed_status = "upcoming";
      else if (now > c.endDate) computed_status = "completed";
      else computed_status = "active";

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        start_date: c.startDate,
        end_date: c.endDate,
        reward: c.reward,
        location: c.location,
        cover_url: c.coverUrl,
        entry_price_cents: c.entryPriceCents,
        status: computed_status,
        created_at: c.created_at,
        participants_count: c.participants.length,
        is_participant: c.participants.some(p => p.userId === userId),
      };
    });
  }

  // --------------------------------
  // CRIAR DESAFIO
  // --------------------------------
  static async createChallenge(data: any) {
    // Remove status se existir, pois não está no schema
    const { status, ...challengeData } = data;
    return prisma.challenge.create({
      data: challengeData,
    });
  }

  // --------------------------------
  // DELETAR DESAFIO
  // --------------------------------
  static async deleteChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId, createdById: userId },
    });

    if (!challenge) return false;

    await prisma.challenge.delete({ where: { id: challenge.id } });

    return true;
  }
}
