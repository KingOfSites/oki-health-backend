import prisma from "../config/database";

export class ChallengesService {
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

    // Count participants for each challenge
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
      is_creator: true,
    }));
  }

  static async listAllChallenges() {
    const challenges = await prisma.challenge.findMany({
      where: { status: "active" },
      orderBy: { created_at: "desc" },
    });

    // Count participants for each challenge
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
}
