import prisma from "../config/database";

export class ChallengesService {

  static async joinChallenge(userId: string, challengeId: string) {
    // evitar duplicidade
    const existing = await prisma.challengeParticipant.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });
  
    if (existing) {
      return existing;
    }
  
    return prisma.challengeParticipant.create({
      data: {
        userId,
        challengeId,
      },
    });
  }
  

  static async listMyChallenges(userId: string) {
    const rows = await prisma.challengeParticipant.findMany({
      where: { userId },
      include: {
        challenge: true,
      },
      orderBy: { joinedAt: "desc" },
    });
  
    const ids = rows.map((r) => r.challengeId);
  
    const counts = await prisma.challengeParticipant.groupBy({
      by: ["challengeId"],
      _count: { challengeId: true },
      where: { challengeId: { in: ids } },
    });
  
    const countMap = new Map(
      counts.map((c) => [c.challengeId, c._count.challengeId])
    );
  
    return rows.map((r) => ({
      id: r.challenge.id,
      title: r.challenge.title,
      description: r.challenge.description,
      type: r.challenge.category,
      status: r.challenge.status,
      start_date: r.challenge.startDate,
      end_date: r.challenge.endDate,
      participants_count: countMap.get(r.challenge.id) || 0,
      progress: r.progress,
      cover_url: r.challenge.coverUrl || null,
      entry_price_cents: r.challenge.entryPriceCents,
      is_creator: r.challenge.createdById === userId,
    }));
  }
  

  static async listCreatedChallenges(userId: string) {
    const rows = await prisma.challenge.findMany({
      where: { createdById: userId },
      orderBy: { created_at: "desc" },
    });
  
    const counts = await prisma.challengeParticipant.groupBy({
      by: ["challengeId"],
      _count: { challengeId: true },
      where: { challengeId: { in: rows.map((c) => c.id) } },
    });
  
    const countMap = new Map(
      counts.map((c) => [c.challengeId, c._count.challengeId])
    );
  
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.category,
      status: c.status,
      start_date: c.startDate,
      end_date: c.endDate,
      participants_count: countMap.get(c.id) || 0,
      cover_url: c.coverUrl || null,
      entry_price_cents: c.entryPriceCents,
      is_creator: true, // sempre true
    }));
  }

  static async getDetails(challengeId: string, userId: string) {
    // 1. Buscar desafio + criador + posts + participantes
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        createdBy: true,
        participants: {
          include: {
            user: true
          }
        },
        posts: {
          include: {
            user: true
          },
          orderBy: { created_at: "desc" }
        }
      }
    });
  
    if (!challenge) throw new Error("Desafio não encontrado");
  
    // 2. Verificar se usuário é criador
    const is_creator = challenge.createdById === userId;
  
    // 3. Verificar se usuário está participando
    const is_participant = challenge.participants.some(
      (p) => p.userId === userId
    );
  
    // 4. Computar status baseado nas datas
    const now = new Date();
    let computed_status: "upcoming" | "active" | "completed";
  
    if (now < challenge.startDate) computed_status = "upcoming";
    else if (now > challenge.endDate) computed_status = "completed";
    else computed_status = "active";
  
    // 5. Contagem de participantes
    const participants_count = challenge.participants.length;
  
    // 6. Criar ranking simples baseado no progresso (0 a 100)
    const ranking = challenge.participants
      .map((p) => ({
        user_id: p.user.id,
        user_name: p.user.name,
        percent_progress: Math.min(100, Math.round(p.progress)),
        photos_submitted: challenge.posts.filter(
          (post) => post.userId === p.userId
        ).length,
        points: Math.round(p.progress * 2),
      }))
      .sort((a, b) => b.percent_progress - a.percent_progress)
      .map((p, index) => ({
        ...p,
        position: index + 1
      }));
  
    // 7. Transformar posts para o front-end
    const posts = challenge.posts.map((post) => ({
      id: post.id,
      challenge_id: post.challengeId,
      user_id: post.userId,
      image_path: post.imageUrl,
      caption: post.caption,
      status: "approved",
      created_at: post.created_at,
      user_name: post.user.name
    }));
  
    // 8. Montar resposta final
    return {
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.category,
        status: challenge.status,
        start_date: challenge.startDate,
        end_date: challenge.endDate,
        entry_price_cents: challenge.entryPriceCents,
        cover_url: challenge.coverUrl,
        participants_count,
        rules: null, // Caso futuramente adicione ao banco
        computed_status,
        is_creator,
        is_participant
      },
      posts,
      ranking,
      chat: [] // Depois podemos implementar chat real
    };
  }

  static async listAllChallenges() {
    const challenges = await prisma.challenge.findMany({
      where: { status: "active" },
      orderBy: { created_at: "desc" },
    });
  
    const counts = await prisma.challengeParticipant.groupBy({
      by: ["challengeId"],
      _count: { challengeId: true },
      where: { challengeId: { in: challenges.map((c) => c.id) } },
    });
  
    const countMap = new Map(
      counts.map((c) => [c.challengeId, c._count.challengeId])
    );
  
    return challenges.map((c) => ({
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
      status: c.status,
      created_at: c.created_at,
      participants_count: countMap.get(c.id) || 0,
    }));
  }
  

  static async createChallenge(data: {
    createdById: string;
    title: string;
    description: string;
    category: string;
    startDate: Date;
    endDate: Date;
    reward?: number;
    location?: string | null;
    coverUrl?: string | null;
    entryPriceCents?: number;
    maxParticipants?: number | null;
  }) {
    return prisma.challenge.create({
      data: {
        ...data,
        status: "active",
      },
    });
  } // <-- ESTA CHAVE FALTAVA!

  static async deleteChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId, createdById: userId },
    });

    if (!challenge) {
      return false;
    }

    const deleted = await prisma.challenge.delete({
      where: { id: challenge.id },
    });

    return !!deleted;
  }
}
