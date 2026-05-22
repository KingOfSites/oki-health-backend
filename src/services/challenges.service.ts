import prisma from "../config/database";
import { randomUUID } from "crypto";

// Converte o campo `frequency` (string variável guardando ex.: "3", "daily", "5x")
// na meta numérica de registros por semana exibida nos cards e nas notificações.
// Retorna null quando o valor não puder ser interpretado como um inteiro válido.
/** Código de 6 caracteres para desafios privados (sem 0/O/I/1). */
export function generateChallengeAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function parseWeeklyGoal(value?: string | null): number | null {
  if (!value) return null;
  const match = String(value).match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  if (!Number.isFinite(n) || n < 1 || n > 7) return null;
  return n;
}

// Retorna o instante (em horário local do servidor) em que o "dia de início"
// do desafio termina (23:59:59.999), usado para definir até quando novos
// participantes podem ingressar e a partir de quando o desafio passa a
// estar fechado para novas entradas / não pode mais ser excluído.
export function computeStartDayBoundaries(c: { startDate: Date }) {
  const start = new Date(c.startDate);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();
  const startOfDay = new Date(y, m, d, 0, 0, 0, 0);
  const endOfDay = new Date(y, m, d, 23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

function computeChallengeStatus(c: { startDate: Date, endDate: Date, startTime?: string | null, endTime?: string | null, status?: string | null }): "draft" | "active" | "finished" | "cancelled" {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "completed") return "finished";
  const now = new Date();
  
  const start = new Date(c.startDate);
  if (c.startTime && /^\d{2}:\d{2}$/.test(c.startTime)) {
    const [h, m] = c.startTime.split(':');
    start.setHours(Number(h), Number(m), 0, 0);
  } else {
    // Se é meia-noite UTC (como salvo pelo Prisma para datas puras), 
    // garante que represente a meia-noite LOCAL do dia correto
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth();
    const d = start.getUTCDate();
    start.setFullYear(y, m, d);
    start.setHours(0, 0, 0, 0);
  }
  
  const end = new Date(c.endDate);
  if (c.endTime && /^\d{2}:\d{2}$/.test(c.endTime)) {
    const [h, m] = c.endTime.split(':');
    end.setHours(Number(h), Number(m), 59, 999);
  } else {
    end.setHours(23, 59, 59, 999);
  }

  if (now < start) return "draft";
  if (now > end) return "finished";
  return "active";
}

export class ChallengesService {
  static async getChallengeAccessState(challengeId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        title: true,
        status: true,
        createdById: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!challenge) {
      return { exists: false as const, challenge: null };
    }

    return {
      exists: true as const,
      challenge,
      isCancelled: challenge.status === "cancelled",
      isCompleted: challenge.status === "completed",
    };
  }

  static async getChallengeMembership(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        createdById: true,
        status: true,
        participants: {
          where: { userId },
          select: { userId: true },
        },
      },
    });

    if (!challenge) {
      return { exists: false as const };
    }

    const isCreator = challenge.createdById === userId;
    // PDF #3: precisamos diferenciar "criador (com ou sem participação)"
    // de "participante puro". Para envio de imagem só vale o
    // participante puro — criador nunca pode enviar foto.
    const isParticipantOnly = challenge.participants.length > 0;
    const isParticipant = isCreator || isParticipantOnly;

    return {
      exists: true as const,
      challenge,
      isCreator,
      isParticipant,
      isParticipantOnly,
      isCancelled: challenge.status === "cancelled",
      isCompleted: challenge.status === "completed",
    };
  }

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
            startTime: true,
            endTime: true,
            status: true,
            coverUrl: true,
            entryPriceCents: true,
            createdById: true,
            isPublic: true,
            frequency: true,
            durationWeeks: true,
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
      const computed_status = computeChallengeStatus(r.challenge);
      const weeklyGoal = parseWeeklyGoal(r.challenge.frequency);
      const { endOfDay: endOfStartDay } = computeStartDayBoundaries(r.challenge);
      const closedForNewParticipants = new Date() > endOfStartDay;

      return {
        id: r.challenge.id,
        title: r.challenge.title,
        description: r.challenge.description,
        type: r.challenge.category,
        category: r.challenge.category,
        status: computed_status,
        participantsCount: countMap.get(r.challenge.id) || 0,
        start_date: r.challenge.startDate,
        end_date: r.challenge.endDate,
        start_time: r.challenge.startTime,
        end_time: r.challenge.endTime,
        participants_count: countMap.get(r.challenge.id) || 0,
        progress: r.progress,
        cover_url: r.challenge.coverUrl || null,
        entry_price_cents: r.challenge.entryPriceCents,
        weekly_goal: weeklyGoal,
        duration_weeks: (r.challenge as any).durationWeeks ?? null,
        durationWeeks: (r.challenge as any).durationWeeks ?? null,
        is_closed_for_new_participants: closedForNewParticipants,
        created_by_id: r.challenge.createdById,
        creator_id: r.challenge.createdById,
        createdById: r.challenge.createdById,
        creatorId: r.challenge.createdById,
        createdBy: { id: r.challenge.createdById },
        creator: { id: r.challenge.createdById },
        isCreator: r.challenge.createdById === userId,
        management: {
          canManage: r.challenge.createdById === userId,
          canEdit: r.challenge.createdById === userId,
          canDelete: r.challenge.createdById === userId,
          canCancel: r.challenge.createdById === userId,
          supportsParticipantCancellation: true,
        },
        is_creator: r.challenge.createdById === userId,
        can_manage: r.challenge.createdById === userId,
        canManage: r.challenge.createdById === userId,
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
        startTime: true,
        endTime: true,
        status: true,
        coverUrl: true,
        entryPriceCents: true,
        createdById: true,
        isPublic: true,
        frequency: true,
        durationWeeks: true,
        participants: {
          select: {
            id: true,
            userId: true,
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
      const computed_status = computeChallengeStatus(c);
      const weeklyGoal = parseWeeklyGoal(c.frequency);
      const { endOfDay: endOfStartDay } = computeStartDayBoundaries(c);
      const closedForNewParticipants = new Date() > endOfStartDay;

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        type: c.category,
        category: c.category,
        status: computed_status,
        participantsCount: countMap.get(c.id) || c.participants.length || 0,
        start_date: c.startDate,
        end_date: c.endDate,
        start_time: c.startTime,
        end_time: c.endTime,
        participants_count: countMap.get(c.id) || c.participants.length || 0,
        cover_url: c.coverUrl,
        entry_price_cents: c.entryPriceCents,
        weekly_goal: weeklyGoal,
        duration_weeks: (c as any).durationWeeks ?? null,
        durationWeeks: (c as any).durationWeeks ?? null,
        is_closed_for_new_participants: closedForNewParticipants,
        created_by_id: c.createdById,
        creator_id: c.createdById,
        createdById: c.createdById,
        creatorId: c.createdById,
        createdBy: { id: c.createdById },
        creator: { id: c.createdById },
        isCreator: true,
        management: {
          canManage: true,
          canEdit: true,
          canDelete: true,
          canCancel: true,
          supportsParticipantCancellation: true,
        },
        is_creator: true,
        can_manage: true,
        canManage: true,
        is_participant: c.participants.some((participant) => participant.userId === userId),
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
        status: true,
        isPublic: true,
        accessCode: true,
        frequency: true,
        durationWeeks: true,
        participants: {
          select: {
            userId: true,
          },
        },
        createdBy: {
          select: {
            name: true,
            nickname: true,
          },
        },
      },
    });

    if (!challenge) return null;

    const computed_status = computeChallengeStatus(challenge);

    const isParticipant = challenge.participants.some(p => p.userId === userId);
    const participants_count = challenge.participants.length;
    const is_creator = challenge.createdById === userId;

    // Desafios privados antigos podem não ter código — gera e persiste para o criador.
    let accessCodeForCreator = challenge.accessCode;
    if (!challenge.isPublic && is_creator && !accessCodeForCreator) {
      accessCodeForCreator = generateChallengeAccessCode();
      await prisma.challenge.update({
        where: { id: challengeId },
        data: { accessCode: accessCodeForCreator },
      });
    }
    const weeklyGoal = parseWeeklyGoal(challenge.frequency);
    const { startOfDay: startOfStartDay, endOfDay: endOfStartDay } =
      computeStartDayBoundaries(challenge);
    const now = new Date();
    const closedForNewParticipants = now > endOfStartDay;
    const allowsCreatorDelete = is_creator && now < startOfStartDay;

    return {
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.category,
        category: challenge.category,
        status: computed_status,
        participantsCount: participants_count,
        start_date: challenge.startDate,
        end_date: challenge.endDate,
        entry_price_cents: challenge.entryPriceCents,
        cover_url: challenge.coverUrl,
        start_time: challenge.startTime,
        end_time: challenge.endTime,
        participants_count,
        rules: null,
        computed_status,
        is_public: challenge.isPublic,
        weekly_goal: weeklyGoal,
        duration_weeks: (challenge as any).durationWeeks ?? null,
        durationWeeks: (challenge as any).durationWeeks ?? null,
        is_closed_for_new_participants: closedForNewParticipants,
        // Só expõe o código para o criador (privacidade)
        access_code: is_creator ? accessCodeForCreator : null,
        accessCode: is_creator ? accessCodeForCreator : null,
        created_by_id: challenge.createdById,
        creator_id: challenge.createdById,
        createdById: challenge.createdById,
        creatorId: challenge.createdById,
        createdBy: {
          id: challenge.createdById,
          name: challenge.createdBy.name,
          nickname: challenge.createdBy.nickname,
        },
        creator: {
          id: challenge.createdById,
          name: challenge.createdBy.name,
          nickname: challenge.createdBy.nickname,
        },
        isCreator: is_creator,
        management: {
          canManage: is_creator,
          canEdit: is_creator,
          canDelete: allowsCreatorDelete,
          canCancel: allowsCreatorDelete,
          supportsParticipantCancellation: true,
        },
        is_creator,
        can_manage: is_creator,
        canManage: is_creator,
        is_participant: isParticipant,
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
        startTime: true,
        endTime: true,
        status: true,
        reward: true,
        location: true,
        coverUrl: true,
        entryPriceCents: true,
        created_at: true,
        createdById: true,
        isPublic: true,
        frequency: true,
        durationWeeks: true,
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });

    return challenges.map(c => {
      const computed_status = computeChallengeStatus(c);
      const weeklyGoal = parseWeeklyGoal(c.frequency);
      const { endOfDay: endOfStartDay } = computeStartDayBoundaries(c);
      const closedForNewParticipants = new Date() > endOfStartDay;

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        start_date: c.startDate,
        end_date: c.endDate,
        start_time: c.startTime,
        end_time: c.endTime,
        reward: c.reward,
        location: c.location,
        cover_url: c.coverUrl,
        entry_price_cents: c.entryPriceCents,
        weekly_goal: weeklyGoal,
        duration_weeks: (c as any).durationWeeks ?? null,
        durationWeeks: (c as any).durationWeeks ?? null,
        is_closed_for_new_participants: closedForNewParticipants,
        status: computed_status,
        created_at: c.created_at,
        participantsCount: c.participants?.length || 0,
        created_by_id: c.createdById,
        creator_id: c.createdById,
        createdById: c.createdById,
        creatorId: c.createdById,
        createdBy: { id: c.createdById },
        creator: { id: c.createdById },
        participants_count: c.participants?.length || 0,
        is_participant: userId ? (c.participants?.some(p => p.userId === userId) || false) : false,
        isCreator: userId ? (c.createdById === userId) : false,
        management: {
          canManage: userId ? (c.createdById === userId) : false,
          canEdit: userId ? (c.createdById === userId) : false,
          canDelete: userId ? (c.createdById === userId) : false,
          canCancel: userId ? (c.createdById === userId) : false,
          supportsParticipantCancellation: true,
        },
        is_creator: userId ? (c.createdById === userId) : false,
        can_manage: userId ? (c.createdById === userId) : false,
        canManage: userId ? (c.createdById === userId) : false,
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
    
    const isPublic =
      challengeData.isPublic !== undefined ? Boolean(challengeData.isPublic) : true;

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
      isPublic,
      accessCode: !isPublic
        ? (challengeData.accessCode?.trim() || generateChallengeAccessCode())
        : null,
      frequency: challengeData.frequency || "daily",
      mode: challengeData.mode || "activity",
      prizeDistributionType: challengeData.prizeDistributionType || "integral",
      latitude: challengeData.latitude || null,
      longitude: challengeData.longitude || null,
      durationWeeks: challengeData.durationWeeks != null ? challengeData.durationWeeks : null,
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

  static async updateChallenge(challengeId: string, userId: string, data: any) {
    const challenge = await prisma.challenge.findFirst({
      where: { id: challengeId, createdById: userId },
    });

    if (!challenge) {
      return { ok: false as const, reason: "not_found_or_forbidden" as const };
    }

    if (challenge.status === "cancelled") {
      return { ok: false as const, reason: "already_cancelled" as const };
    }

    if (challenge.status === "completed") {
      return { ok: false as const, reason: "already_completed" as const };
    }

    const updateData: any = {};
    const directFields = [
      "title",
      "description",
      "category",
      "location",
      "coverUrl",
      "reward",
      "entryPriceCents",
      "firstPlacePrizeCents",
      "secondPlacePrizeCents",
      "thirdPlacePrizeCents",
      "minAge",
      "minWeight",
      "maxWeight",
      "requiredActivityLevel",
      "isPublic",
      "frequency",
      "mode",
      "prizeDistributionType",
      "latitude",
      "longitude",
      "maxParticipants",
      "durationWeeks",
    ];

    for (const field of directFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
    }

    if (data.endDate !== undefined) {
      updateData.endDate = new Date(data.endDate);
    }

    if (data.startTime !== undefined) {
      updateData.startTime = data.startTime || null;
    }

    if (data.endTime !== undefined) {
      updateData.endTime = data.endTime || null;
    }

    if (updateData.startTime && !/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(updateData.startTime)) {
      return { ok: false as const, reason: "invalid_start_time" as const };
    }

    if (updateData.endTime && !/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(updateData.endTime)) {
      return { ok: false as const, reason: "invalid_end_time" as const };
    }

    const nextStartTime = updateData.startTime !== undefined ? updateData.startTime : challenge.startTime;
    const nextEndTime = updateData.endTime !== undefined ? updateData.endTime : challenge.endTime;

    if ((nextStartTime && !nextEndTime) || (!nextStartTime && nextEndTime)) {
      return { ok: false as const, reason: "incomplete_time_window" as const };
    }

    if (nextStartTime && nextEndTime) {
      const [startHour, startMinute] = nextStartTime.split(":").map(Number);
      const [endHour, endMinute] = nextEndTime.split(":").map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (endMinutes <= startMinutes) {
        return { ok: false as const, reason: "invalid_time_window" as const };
      }
    }

    const updatedChallenge = await prisma.challenge.update({
      where: { id: challengeId },
      data: updateData,
    });

    return { ok: true as const, challenge: updatedChallenge };
  }

  // --------------------------------
  // DELETAR DESAFIO (cancelar)
  // Só pode cancelar ANTES de qualquer participante entrar.
  // --------------------------------
  static async deleteChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findFirst({
      where: { id: challengeId, createdById: userId },
      include: { participants: { select: { id: true, userId: true } } },
    });

    if (!challenge) return { ok: false, reason: "not_found" as const };

    // Após o início do desafio (a partir de 00:00 da data programada) o
    // criador não pode mais excluí-lo.
    const { startOfDay: startOfStartDay } = computeStartDayBoundaries(challenge);
    if (new Date() >= startOfStartDay) {
      return { ok: false, reason: "already_started" as const };
    }

    const hasOtherParticipants = challenge.participants.some(
      (participant) => participant.userId !== userId
    );

    if (hasOtherParticipants) {
      const cancelled = await this.cancelChallenge(challengeId, userId);
      if (!cancelled.ok) {
        return cancelled;
      }

      return {
        ok: true as const,
        mode: "cancelled" as const,
        participantCount: cancelled.participantCount,
      };
    }

    if (challenge.participants.length > 0) {
      await prisma.challengeParticipant.deleteMany({
        where: { challengeId: challenge.id },
      });
    }

    await prisma.challenge.delete({ where: { id: challenge.id } });
    return { ok: true as const, mode: "deleted" as const };
  }

  static async cancelChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        title: true,
        createdById: true,
        status: true,
        startDate: true,
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!challenge) return { ok: false as const, reason: "not_found" as const };
    if (challenge.createdById !== userId) return { ok: false as const, reason: "forbidden" as const };
    if (challenge.status === "cancelled") return { ok: false as const, reason: "already_cancelled" as const };
    if (challenge.status === "completed") return { ok: false as const, reason: "already_completed" as const };

    // Após o início (00:00 da data programada), também bloqueia o cancelamento.
    const { startOfDay: startOfStartDay } = computeStartDayBoundaries(challenge);
    if (new Date() >= startOfStartDay) {
      return { ok: false as const, reason: "already_started" as const };
    }

    const participantIds = Array.from(
      new Set(
        challenge.participants
          .map((participant) => participant.userId)
          .filter((participantId) => participantId !== userId)
      )
    );

    await prisma.$transaction(async (tx) => {
      await tx.challenge.update({
        where: { id: challenge.id },
        data: { status: "cancelled" },
      });

      if (participantIds.length > 0) {
        await tx.notification.createMany({
          data: participantIds.map((participantId) => ({
            id: randomUUID(),
            userId: participantId,
            challengeId: challenge.id,
            title: "Desafio cancelado",
            body: `O desafio "${challenge.title}" foi cancelado pelo criador.`,
            type: "challenge_cancelled",
          })),
        });
      }
    });

    return {
      ok: true as const,
      challengeId: challenge.id,
      participantCount: participantIds.length,
    };
  }

  // --------------------------------
  // PARTICIPAR DE DESAFIO
  // --------------------------------
  static async joinChallenge(
    userId: string,
    challengeId: string,
    accessCode?: string,
  ) {
    // Verificar se o desafio existe
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error("Desafio não encontrado");
    }

    // Desafio privado exige código de acesso (exceto para o criador)
    if (
      challenge.isPublic === false &&
      challenge.createdById !== userId &&
      challenge.accessCode
    ) {
      const provided = (accessCode || "").trim().toUpperCase();
      if (!provided) {
        return {
          requiresAccessCode: true,
          already: false,
          message: "Este desafio é privado. Informe o código de acesso.",
        };
      }
      if (provided !== challenge.accessCode.toUpperCase()) {
        return {
          requiresAccessCode: true,
          invalidAccessCode: true,
          already: false,
          message: "Código de acesso inválido.",
        };
      }
    }

    if (challenge.status === "cancelled") {
      return {
        requiresPayment: false,
        already: false,
        challengeCancelled: true,
        message: "Este desafio foi cancelado e nÃ£o aceita novas entradas.",
      };
    }

    if (challenge.status === "completed") {
      return {
        requiresPayment: false,
        already: false,
        challengeEnded: true,
        message: "Este desafio jÃ¡ foi concluÃ­do e nÃ£o aceita mais participantes.",
      };
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

    // Novos participantes só podem entrar até o final do dia de início.
    // Após o dia de início (00:00 do dia seguinte) o desafio é fechado para
    // novas entradas, mantendo os já inscritos.
    const { endOfDay: endOfStartDay } = computeStartDayBoundaries(challenge);
    if (now > endOfStartDay) {
      return {
        requiresPayment: false,
        already: false,
        challengeStarted: true,
        message: "Desafio já iniciado. Não é permitido a entrada de novos participantes.",
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

    // O criador é o organizador do desafio — nunca paga a taxa de entrada.
    const isOwnChallenge = challenge.createdById === userId;

    if (entryPrice > 0 && !isOwnChallenge) {
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
