import prisma from "../config/database";

export class ChallengesService {

  // ================================
  // 1 — MEUS DESAFIOS
  // ================================
  static async listMyChallenges(userId: string) {
    const rows = await prisma.challengeParticipant.findMany({
      where: { userId },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            startDate: true,
            endDate: true,
            coverUrl: true,
            entryPriceCents: true,
            createdById: true,
          },
        },
      },
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
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        startDate: true,
        endDate: true,
        coverUrl: true,
        entryPriceCents: true,
        participants: {
          select: {
            id: true,
          },
        },
      },
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
        participants_count: countMap.get(c.id) || c.participants.length || 0,
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
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        startDate: true,
        endDate: true,
        reward: true,
        location: true,
        entryPriceCents: true,
        coverUrl: true,
        createdById: true,
        participants: {
          select: {
            userId: true,
          },
        },
        createdBy: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!challenge) return null;

    // Calcular status baseado nas datas
    const now = new Date();
    let computed_status: "upcoming" | "active" | "completed";
    if (now < challenge.startDate) computed_status = "upcoming";
    else if (now > challenge.endDate) computed_status = "completed";
    else computed_status = "active";

    const isParticipant = challenge.participants.some(p => p.userId === userId);
    const participants_count = challenge.participants.length;
    const is_creator = challenge.createdById === userId;

    return {
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.category,
        status: computed_status,
        start_date: challenge.startDate,
        end_date: challenge.endDate,
        entry_price_cents: challenge.entryPriceCents,
        cover_url: challenge.coverUrl,
        participants_count,
        rules: null,
        computed_status,
        is_creator,
        is_participant: isParticipant,
        createdBy: challenge.createdBy,
      },
      posts: [],
      ranking: [],
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
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        startDate: true,
        endDate: true,
        reward: true,
        location: true,
        coverUrl: true,
        entryPriceCents: true,
        created_at: true,
        participants: {
          select: {
            userId: true,
          },
        },
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
        participants_count: c.participants?.length || 0,
        is_participant: userId ? (c.participants?.some(p => p.userId === userId) || false) : false,
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

  // --------------------------------
  // PARTICIPAR DE DESAFIO
  // --------------------------------
  static async joinChallenge(userId: string, challengeId: string) {
    // Verificar se o desafio existe
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error("Desafio não encontrado");
    }

    // Verificar se o desafio já terminou
    const now = new Date();
    if (now > challenge.endDate) {
      return {
        requiresPayment: false,
        already: false,
        challengeEnded: true,
        message: "Este desafio já foi concluído e não aceita mais participantes.",
      };
    }

    // Verificar se já está participando
    const existingParticipant = await prisma.challengeParticipant.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });

    if (existingParticipant) {
      return {
        already: true,
        requiresPayment: false,
        participant: existingParticipant,
      };
    }

    // Buscar dados do usuário para validação de critérios
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        age: true,
        peso: true,
        atividade: true,
      },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Validar critérios de participação
    const validationErrors: string[] = [];

    // Verificar idade mínima
    if (challenge.minAge !== null && challenge.minAge !== undefined) {
      if (!user.age || user.age < challenge.minAge) {
        validationErrors.push(`Idade mínima requerida: ${challenge.minAge} anos. Sua idade: ${user.age || 'não informada'} anos.`);
      }
    }

    // Verificar peso
    if (challenge.minWeight !== null && challenge.minWeight !== undefined || 
        challenge.maxWeight !== null && challenge.maxWeight !== undefined) {
      if (!user.peso) {
        validationErrors.push("Peso não informado no perfil. Por favor, atualize seu perfil.");
      } else {
        if (challenge.minWeight !== null && challenge.minWeight !== undefined && user.peso < challenge.minWeight) {
          validationErrors.push(`Peso mínimo requerido: ${challenge.minWeight} kg. Seu peso: ${user.peso} kg.`);
        }
        if (challenge.maxWeight !== null && challenge.maxWeight !== undefined && user.peso > challenge.maxWeight) {
          validationErrors.push(`Peso máximo permitido: ${challenge.maxWeight} kg. Seu peso: ${user.peso} kg.`);
        }
      }
    }

    // Verificar nível de atividade
    if (challenge.requiredActivityLevel) {
      if (!user.atividade) {
        validationErrors.push("Frequência de atividade não informada no perfil. Por favor, atualize seu perfil.");
      } else {
        // Hierarquia de níveis de atividade (maior = mais intenso)
        const activityLevels: Record<string, number> = {
          "sedentario": 1,
          "leve": 2,
          "moderado": 3,
          "intenso": 4,
          "muito_intenso": 5,
        };

        const userLevel = activityLevels[user.atividade] || 0;
        const requiredLevel = activityLevels[challenge.requiredActivityLevel] || 0;

        if (userLevel < requiredLevel) {
          const activityLabels: Record<string, string> = {
            "sedentario": "Sedentário",
            "leve": "Leve",
            "moderado": "Moderado",
            "intenso": "Intenso",
            "muito_intenso": "Muito Intenso",
          };
          validationErrors.push(`Nível de atividade requerido: ${activityLabels[challenge.requiredActivityLevel]}. Seu nível: ${activityLabels[user.atividade] || 'não informado'}.`);
        }
      }
    }

    // Se houver erros de validação, retornar erro
    if (validationErrors.length > 0) {
      return {
        requiresPayment: false,
        already: false,
        validationFailed: true,
        errors: validationErrors,
        message: "Você não atende aos critérios de participação deste desafio:\n" + validationErrors.join("\n"),
      };
    }

    // Verificar se o desafio tem preço de entrada
    const entryPrice = challenge.entryPriceCents || 0;

    if (entryPrice > 0) {
      // Verificar se já existe pagamento aprovado
      const paidTransaction = await prisma.transaction.findFirst({
        where: {
          userId,
          challengeId,
          type: "challenge_entry",
          status: "approved",
        },
      });

      if (!paidTransaction) {
        // Requer pagamento
        return {
          requiresPayment: true,
          already: false,
          price: entryPrice / 100, // Converter centavos para reais
          message: `Este desafio requer pagamento de entrada de R$ ${(entryPrice / 100).toFixed(2)}`,
        };
      }
    }

    // Criar participante
    const participant = await prisma.challengeParticipant.create({
      data: {
        userId,
        challengeId,
        progress: 0,
        points: 0,
      },
    });

    return {
      requiresPayment: false,
      already: false,
      participant,
    };
  }

  // --------------------------------
  // COMPLETAR DESAFIO
  // --------------------------------
  static async completeChallenge(userId: string, challengeId: string) {
    // Verificar se o desafio existe
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error("Desafio não encontrado");
    }

    // Verificar se está participando
    const participant = await prisma.challengeParticipant.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });

    if (!participant) {
      throw new Error("Você não está participando deste desafio");
    }

    // Atualizar progresso para 100%
    await prisma.challengeParticipant.update({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
      data: {
        progress: 100,
      },
    });

    // Adicionar recompensa ao saldo do usuário
    const reward = challenge.reward || 0;
    if (reward > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: reward },
          total_earned: { increment: reward },
        },
      });
    }

    return {
      message: "Desafio completado com sucesso!",
      reward,
    };
  }
}
