import prisma from "../config/database";

export class ChallengesService {

  // -----------------------
  // PARTICIPAR DO DESAFIO
  // -----------------------
  static async joinChallenge(userId: string, challengeId: string) {
    const existing = await prisma.challengeParticipant.findUnique({
      where: {
        userId_challengeId: { userId, challengeId },
      },
    });

    if (existing) return existing;

    return prisma.challengeParticipant.create({
      data: { userId, challengeId },
    });
  }

  // --------------------------------
  // MEUS DESAFIOS (INSCRIÇÕES)
  // --------------------------------
  static async listMyChallenges(userId: string) {
    const rows = await prisma.challengeParticipant.findMany({
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
    const rows = await prisma.challenge.findMany({
      where: { createdById: userId },
      orderBy: { created_at: "desc" },
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

  // --------------------------------
  // DETALHES DO DESAFIO
  // --------------------------------
  static async getDetails(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        createdBy: true,
        participants: {
          include: {
            users: true, // <-- CORRETO
          },
        },
        posts: {
          include: { user: true },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!challenge) throw new Error("Desafio não encontrado");

    const is_creator = challenge.createdById === userId;

    const is_participant = challenge.participants.some(p => p.userId === userId);

    // STATUS
    const now = new Date();
    let computed_status: "upcoming" | "active" | "completed";

    if (now < challenge.startDate) computed_status = "upcoming";
    else if (now > challenge.endDate) computed_status = "completed";
    else computed_status = "active";

    const participants_count = challenge.participants.length;

    // RANKING
    const ranking = challenge.participants
      .map(p => ({
        user_id: p.users.id,
        user_name: p.users.name,
        percent_progress: Math.min(100, Math.round(p.progress)),
        photos_submitted: challenge.posts.filter(post => post.userId === p.userId).length,
        points: Math.round(p.progress * 2),
      }))
      .sort((a, b) => b.percent_progress - a.percent_progress)
      .map((p, index) => ({
        ...p,
        position: index + 1,
      }));

    // POSTS
    const posts = challenge.posts.map(post => ({
      id: post.id,
      challenge_id: post.challengeId,
      user_id: post.userId,
      image_path: post.imageUrl,
      caption: post.caption,
      status: "approved",
      created_at: post.created_at,
      user_name: post.user.name,
    }));

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
