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
            isPublic: true,
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
        is_private: r.challenge.isPublic === false,
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
        isPublic: true,
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
        is_private: c.isPublic === false,
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
        startTime: true,
        endTime: true,
        isPublic: true,
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
        start_time: challenge.startTime,
        end_time: challenge.endTime,
        participants_count,
        rules: null,
        computed_status,
        is_creator,
        is_participant: isParticipant,
        createdBy: challenge.createdBy,
        is_private: challenge.isPublic === false,
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
        isPublic: true,
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
        is_private: c.isPublic === false,
      };
    });
  }

  // --------------------------------
  // CRIAR DESAFIO
  // --------------------------------
  static async createChallenge(data: any) {
    // Remove status se existir, pois não está no schema
    const { status, ...challengeData } = data;
    
    // Garantir que startTime e endTime sejam strings válidas ou null (nunca undefined)
    if (challengeData.startTime !== null && challengeData.startTime !== undefined) {
      if (typeof challengeData.startTime === 'string' && challengeData.startTime.trim()) {
        challengeData.startTime = challengeData.startTime.trim();
        // Validar formato HH:MM
        if (!/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(challengeData.startTime)) {
          throw new Error("Formato de horário inicial inválido. Use HH:MM (ex: 09:00)");
        }
      } else {
        challengeData.startTime = null;
      }
    } else {
      challengeData.startTime = null;
    }
    
    if (challengeData.endTime !== null && challengeData.endTime !== undefined) {
      if (typeof challengeData.endTime === 'string' && challengeData.endTime.trim()) {
        challengeData.endTime = challengeData.endTime.trim();
        // Validar formato HH:MM
        if (!/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(challengeData.endTime)) {
          throw new Error("Formato de horário final inválido. Use HH:MM (ex: 12:00)");
        }
      } else {
        challengeData.endTime = null;
      }
    } else {
      challengeData.endTime = null;
    }
    
    // Criar objeto de dados garantindo que todos os campos opcionais sejam null ao invés de undefined
    const prismaData: any = {
      createdById: challengeData.createdById,
      title: challengeData.title,
      description: challengeData.description,
      category: challengeData.category,
      startDate: challengeData.startDate,
      endDate: challengeData.endDate,
      reward: challengeData.reward || 0,
      location: challengeData.location || null,
      coverUrl: challengeData.coverUrl || null,
      entryPriceCents: challengeData.entryPriceCents || 0,
      maxParticipants: challengeData.maxParticipants || null,
      firstPlacePrizeCents: challengeData.firstPlacePrizeCents || 0,
      secondPlacePrizeCents: challengeData.secondPlacePrizeCents || 0,
      thirdPlacePrizeCents: challengeData.thirdPlacePrizeCents || 0,
      minAge: challengeData.minAge || null,
      minWeight: challengeData.minWeight || null,
      maxWeight: challengeData.maxWeight || null,
      requiredActivityLevel: challengeData.requiredActivityLevel || null,
      startTime: challengeData.startTime, // Já processado acima
      endTime: challengeData.endTime, // Já processado acima
      isPublic: challengeData.isPublic !== undefined ? Boolean(challengeData.isPublic) : true,
      frequency: challengeData.frequency || "daily",
      mode: challengeData.mode || "activity",
      prizeDistributionType: challengeData.prizeDistributionType || "integral",
      latitude: challengeData.latitude || null,
      longitude: challengeData.longitude || null,
    };
    
    // Garantir explicitamente que startTime e endTime estejam no objeto
    // Mesmo que sejam null, eles devem estar presentes para o Prisma salvar
    prismaData.startTime = challengeData.startTime === undefined ? null : challengeData.startTime;
    prismaData.endTime = challengeData.endTime === undefined ? null : challengeData.endTime;
    
    console.log("💾 [ChallengesService] Salvando desafio com horários:", {
      startTime: prismaData.startTime,
      endTime: prismaData.endTime,
      startTimeType: typeof prismaData.startTime,
      endTimeType: typeof prismaData.endTime,
      startTimeInData: challengeData.startTime,
      endTimeInData: challengeData.endTime,
    });
    
    console.log("💾 [ChallengesService] Objeto completo que será salvo:", JSON.stringify(prismaData, null, 2));
    
    const challenge = await prisma.challenge.create({
      data: prismaData,
    });

    const creatorParticipates = challengeData.creatorParticipates !== false;
    if (creatorParticipates) {
      await prisma.challengeParticipant.create({
        data: {
          userId: challengeData.createdById,
          challengeId: challenge.id,
          progress: 0,
          points: 0,
        },
      });
    }
    
    console.log("✅ [ChallengesService] Desafio salvo no banco (criador como participante:", creatorParticipates, "):", {
      id: challenge.id,
      startTime: challenge.startTime,
      endTime: challenge.endTime,
    });
    
    return challenge;
  }

  // --------------------------------
  // DELETAR DESAFIO (cancelar)
  // Só pode cancelar ANTES de qualquer participante entrar.
  // --------------------------------
  static async deleteChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId, createdById: userId },
      include: { participants: { select: { id: true } } },
    });

    if (!challenge) return { ok: false, reason: "not_found" as const };

    if (challenge.participants.length > 0) {
      return { ok: false, reason: "has_participants" as const };
    }

    await prisma.challenge.delete({ where: { id: challenge.id } });
    return { ok: true };
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

    const now = new Date();
    if (now > challenge.endDate) {
      return {
        requiresPayment: false,
        already: false,
        challengeEnded: true,
        message: "Este desafio já foi concluído e não aceita mais participantes.",
      };
    }

    if (now >= challenge.startDate) {
      return {
        requiresPayment: false,
        already: false,
        challengeStarted: true,
        message: "Após o início do desafio não é permitida a entrada de novos participantes.",
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
        medicationLast6Months: true,
        surgeryLast6Months: true,
      } as any,
    }) as any;

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Validar critérios de participação
    const validationErrors: string[] = [];

    // Validação específica para Modo Balança
    const challengeMode = (challenge as any).mode || "activity";
    if (challengeMode === "scale") {
      if (user.medicationLast6Months) {
        validationErrors.push("Desafios no Modo Balança não permitem participantes que usaram medicamentos para emagrecer nos últimos 6 meses.");
      }
      if (user.surgeryLast6Months) {
        validationErrors.push("Desafios no Modo Balança não permitem participantes que realizaram cirurgia bariátrica nos últimos 6 meses.");
      }
      if (!user.peso) {
        validationErrors.push("Seu peso atual deve estar cadastrado no perfil para participar de desafios no Modo Balança.");
      }
    }

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
  // META DE PERDA DE PESO (Modo Balança)
  // --------------------------------
  static calculateWeightGoal(currentWeightKg: number, durationWeeks: number): { goalWeightKg: number; goalPercent: number } {
    // 12 semanas = 4%, 24 semanas = 8%
    // Interpolação linear para outros valores
    let goalPercent: number;
    if (durationWeeks <= 12) {
      goalPercent = 4;
    } else if (durationWeeks >= 24) {
      goalPercent = 8;
    } else {
      // Interpolação linear entre 12 e 24 semanas
      goalPercent = 4 + ((durationWeeks - 12) / 12) * 4;
    }
    const goalWeightKg = parseFloat((currentWeightKg * (1 - goalPercent / 100)).toFixed(1));
    return { goalWeightKg, goalPercent };
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
