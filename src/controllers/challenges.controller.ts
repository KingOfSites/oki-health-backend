import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { ChallengesService } from "../services/challenges.service";
import prisma from "../config/database";

export class ChallengesController {

  // ================================
  // ✔️ MEUS DESAFIOS (INSCRITO)
  // ================================
  static async listMyChallenges(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const data = await ChallengesService.listMyChallenges(req.userId);
      return res.json({ success: true, data });

    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ DESAFIOS CRIADOS POR MIM
  // ================================
  static async listCreatedChallenges(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const data = await ChallengesService.listCreatedChallenges(req.userId);
      return res.json({ success: true, data });

    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ CRIAR DESAFIO
  // ================================
  static async createChallenge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      console.log("📥 [Create Challenge] Body recebido completo:", JSON.stringify(req.body, null, 2));
      
      const {
        title,
        description,
        category,
        startDate,
        endDate,
        reward,
        location,
        coverUrl,
        entryPriceCents,
        maxParticipants,
        firstPlacePrizeCents,
        secondPlacePrizeCents,
        thirdPlacePrizeCents,
        minAge,
        minWeight,
        maxWeight,
        requiredActivityLevel,
        startTime,
        endTime,
        isPublic,
        frequency,
        weeklyFrequency,
        trainStartTime,
        trainEndTime,
        creatorParticipates,
        mode,
        prizeDistributionType,
        latitude,
        longitude,
        durationWeeks,
      } = req.body;

      // Modo "move" envia weeklyFrequency (número 2-7) em vez de frequency.
      // Persistimos na coluna `frequency` (varchar) para reaproveitar o
      // schema atual e expor a meta semanal nos cards/notificações.
      const resolvedFrequency =
        weeklyFrequency != null
          ? String(weeklyFrequency)
          : (frequency || "daily");

      // Aceita campos alternativos vindos do app de criação (trainStartTime/trainEndTime).
      const effectiveStartTime = startTime ?? trainStartTime;
      const effectiveEndTime = endTime ?? trainEndTime;
      
      console.log("📥 [Create Challenge] Horários extraídos do body:", {
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        startTimeType: typeof effectiveStartTime,
        endTimeType: typeof effectiveEndTime,
        weeklyFrequency,
        resolvedFrequency,
      });

      if (!title || !description || !category || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Campos obrigatórios: title, description, category, startDate, endDate",
        });
      }

      // Validar título ofensivo/discriminatório
      const validateTitleContent = (titleText: string): { valid: boolean; message?: string } => {
        const offensiveWords = [
          // Lista de palavras ofensivas (pode ser expandida)
          "idiota", "burro", "estúpido", "imbecil", "retardado", "deficiente",
          "gordo", "magro", "feio", "nojento", "horrível",
          "viado", "bicha", "sapatão", "traveco", "travesti",
          "puta", "prostituta", "vagabunda",
          "preto", "negro", "branco", "amarelo", // Contexto pode variar
        ];
        
        const titleLower = titleText.toLowerCase().trim();
        for (const word of offensiveWords) {
          if (titleLower.includes(word)) {
            return {
              valid: false,
              message: "O título contém palavras inapropriadas ou discriminatórias. Por favor, use um título respeitoso e inclusivo.",
            };
          }
        }
        
        return { valid: true };
      };

      const titleValidation = validateTitleContent(title);
      if (!titleValidation.valid) {
        return res.status(400).json({
          success: false,
          message: titleValidation.message || "Título contém palavras inapropriadas",
        });
      }

      // Validar que a data de início é a partir do dia seguinte
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Extrair apenas a data YYYY-MM-DD para evitar problemas de fuso horário na validação
      const datePart = typeof startDate === 'string' ? startDate.split('T')[0] : new Date(startDate).toISOString().split('T')[0];
      const [y, m, d] = datePart.split('-').map(Number);
      const startDateObj = new Date(y, m - 1, d); // Meia-noite local do servidor
      
      if (startDateObj.getTime() <= today.getTime()) {
        return res.status(400).json({
          success: false,
          message: "A data de início deve ser a partir de amanhã",
        });
      }

      // Validar número mínimo de participantes (mínimo 2)
      if (maxParticipants !== null && maxParticipants !== undefined) {
        const maxParticipantsNum = parseInt(maxParticipants);
        if (isNaN(maxParticipantsNum) || maxParticipantsNum < 2) {
          return res.status(400).json({
            success: false,
            message: "O número mínimo de participantes é 2",
          });
        }
      }

      // Processar horários - garantir que sejam strings válidas ou null
      let processedStartTime: string | null = null;
      let processedEndTime: string | null = null;

      // Se startTime foi fornecido, processar
      if (effectiveStartTime !== null && effectiveStartTime !== undefined && effectiveStartTime !== '') {
        if (typeof effectiveStartTime === 'string' && effectiveStartTime.trim()) {
          processedStartTime = effectiveStartTime.trim();
          // Validar formato HH:MM
          if (!/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(processedStartTime)) {
            return res.status(400).json({
              success: false,
              message: "Formato de horário inicial inválido. Use HH:MM (ex: 09:00)",
            });
          }
        }
      }

      // Se endTime foi fornecido, processar
      if (effectiveEndTime !== null && effectiveEndTime !== undefined && effectiveEndTime !== '') {
        if (typeof effectiveEndTime === 'string' && effectiveEndTime.trim()) {
          processedEndTime = effectiveEndTime.trim();
          // Validar formato HH:MM
          if (!/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(processedEndTime)) {
            return res.status(400).json({
              success: false,
              message: "Formato de horário final inválido. Use HH:MM (ex: 12:00)",
            });
          }
        }
      }

      // Validar que se um horário for fornecido, o outro também deve ser
      if ((processedStartTime && !processedEndTime) || (!processedStartTime && processedEndTime)) {
        return res.status(400).json({
          success: false,
          message: "Se fornecer horários, deve fornecer tanto o horário inicial quanto o final",
        });
      }

      // Validar que o horário final é posterior ao inicial
      if (processedStartTime && processedEndTime) {
        const [startHour, startMin] = processedStartTime.split(":").map(Number);
        const [endHour, endMin] = processedEndTime.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            success: false,
            message: "O horário final deve ser posterior ao horário inicial",
          });
        }
      }

      console.log("📝 [Create Challenge] Dados recebidos:", {
        title,
        isPublic,
        frequency,
        maxParticipants,
        startTime: processedStartTime,
        endTime: processedEndTime,
        startTimeType: typeof processedStartTime,
        endTimeType: typeof processedEndTime,
        startTimeRaw: startTime,
        endTimeRaw: endTime,
      });

      const isPublicResolved = isPublic !== undefined ? Boolean(isPublic) : true;

      // Para desafios privados, gerar código de acesso de 6 caracteres alfanuméricos
      const generateAccessCode = (): string => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/I/1
        let out = "";
        for (let i = 0; i < 6; i++) {
          out += chars[Math.floor(Math.random() * chars.length)];
        }
        return out;
      };

      const challengePayload: any = {
        createdById: req.userId,
        title,
        description,
        category,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reward: reward || 0,
        location: location || null,
        coverUrl: coverUrl || null,
        entryPriceCents: entryPriceCents || 0,
        maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
        firstPlacePrizeCents: firstPlacePrizeCents || 0,
        secondPlacePrizeCents: secondPlacePrizeCents || 0,
        thirdPlacePrizeCents: thirdPlacePrizeCents || 0,
        minAge: minAge ? parseInt(minAge) : null,
        minWeight: minWeight ? parseFloat(minWeight) : null,
        maxWeight: maxWeight ? parseFloat(maxWeight) : null,
        requiredActivityLevel: requiredActivityLevel || null,
        isPublic: isPublicResolved,
        accessCode: isPublicResolved ? null : generateAccessCode(),
        frequency: resolvedFrequency,
        mode: mode || "activity",
        prizeDistributionType: prizeDistributionType || "integral",
        latitude: latitude != null ? parseFloat(latitude) : null,
        longitude: longitude != null ? parseFloat(longitude) : null,
        // PDF #1: persistir a duração escolhida pelo usuário para garantir
        // que o valor exibido em todas as telas reflita exatamente o que
        // foi selecionado, sem depender de cálculos a partir de start/end.
        durationWeeks: durationWeeks != null ? parseInt(durationWeeks) : null,
      };
      challengePayload.creatorParticipates = creatorParticipates !== false;
      
      // Adicionar horários apenas se foram fornecidos
      if (processedStartTime !== null) {
        challengePayload.startTime = processedStartTime;
      } else {
        challengePayload.startTime = null;
      }
      
      if (processedEndTime !== null) {
        challengePayload.endTime = processedEndTime;
      } else {
        challengePayload.endTime = null;
      }

      const data = await ChallengesService.createChallenge(challengePayload);

      console.log("✅ [Create Challenge] Desafio criado com sucesso:", {
        id: data.id,
        startTime: data.startTime,
        endTime: data.endTime,
      });

      return res.status(201).json({ success: true, data });

    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ BUSCAR DESAFIOS (Explorar)
  // ================================
 // ================================
// ✔️ BUSCAR DESAFIOS (Explorar)
// ================================
static async searchChallenges(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { location, filter } = req.query;

      // Se location for "all" ou vazio, retornar todos os desafios
      if (location === "all" || !location) {
        const userId = req.userId; // Pode ser undefined se não autenticado
        const challenges = await prisma.challenge.findMany({
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            startDate: true,
            endDate: true,
            startTime: true,
            endTime: true,
            reward: true,
            location: true,
            coverUrl: true,
            entryPriceCents: true,
            firstPlacePrizeCents: true,
            secondPlacePrizeCents: true,
            thirdPlacePrizeCents: true,
            created_at: true,
            isPublic: true,
            frequency: true,
            durationWeeks: true,
            status: true,
            participants: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: {
            created_at: "desc",
          },
        });

        return res.json({
          success: true,
          data: {
            challenges: challenges.map((c) => {
              const startDayBounds = (() => {
                const start = new Date(c.startDate);
                const y = start.getUTCFullYear();
                const m = start.getUTCMonth();
                const d = start.getUTCDate();
                return new Date(y, m, d, 23, 59, 59, 999);
              })();
              const weeklyGoalMatch = c.frequency ? String(c.frequency).match(/\d+/) : null;
              const weeklyGoal = weeklyGoalMatch ? parseInt(weeklyGoalMatch[0], 10) : null;

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
                first_place_prize_cents: c.firstPlacePrizeCents,
                second_place_prize_cents: c.secondPlacePrizeCents,
                third_place_prize_cents: c.thirdPlacePrizeCents,
                participants_count: c.participants.length,
                is_participant: userId ? c.participants.some((p) => p.userId === userId) : false,
                is_private: c.isPublic === false,
                weekly_goal: weeklyGoal && weeklyGoal >= 1 && weeklyGoal <= 7 ? weeklyGoal : null,
                duration_weeks: (c as any).durationWeeks ?? null,
                durationWeeks: (c as any).durationWeeks ?? null,
                is_closed_for_new_participants: new Date() > startDayBounds,
              };
            }),
          },
        });
      }

      if (!filter) {
        return res.status(400).json({
          success: false,
          message: "Parâmetro 'filter' é obrigatório quando 'location' é especificado",
        });
      }

      const userId = req.userId; // Pode ser undefined se não autenticado
      const challenges = await prisma.challenge.findMany({
        where: {
          location: {
            contains: String(location),
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          startDate: true,
          endDate: true,
          startTime: true,
          endTime: true,
          reward: true,
          location: true,
          coverUrl: true,
          entryPriceCents: true,
          firstPlacePrizeCents: true,
          secondPlacePrizeCents: true,
          thirdPlacePrizeCents: true,
          created_at: true,
          isPublic: true,
          frequency: true,
          status: true,
          participants: {
            select: {
              userId: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return res.json({
        success: true,
        data: {
          challenges: challenges.map((c) => {
            const start = new Date(c.startDate);
            const startDayEnd = new Date(
              start.getUTCFullYear(),
              start.getUTCMonth(),
              start.getUTCDate(),
              23, 59, 59, 999,
            );
            const weeklyGoalMatch = c.frequency ? String(c.frequency).match(/\d+/) : null;
            const weeklyGoal = weeklyGoalMatch ? parseInt(weeklyGoalMatch[0], 10) : null;
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
              first_place_prize_cents: c.firstPlacePrizeCents,
              second_place_prize_cents: c.secondPlacePrizeCents,
              third_place_prize_cents: c.thirdPlacePrizeCents,
              participants_count: c.participants.length,
              is_participant: userId ? c.participants.some((p) => p.userId === userId) : false,
              is_private: c.isPublic === false,
              weekly_goal: weeklyGoal && weeklyGoal >= 1 && weeklyGoal <= 7 ? weeklyGoal : null,
              duration_weeks: (c as any).durationWeeks ?? null,
              durationWeeks: (c as any).durationWeeks ?? null,
              is_closed_for_new_participants: new Date() > startDayEnd,
            };
          }),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ ENTRAR NO DESAFIO
  // ================================
  static async joinChallenge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const challengeId = req.params.challengeId;
      if (!challengeId) {
        return res.status(400).json({
          success: false,
          message: "ID do desafio inválido",
        });
      }

      const accessCode = (req.body?.accessCode as string | undefined)?.trim();
      const result = await ChallengesService.joinChallenge(
        req.userId,
        challengeId,
        accessCode,
      );

      // 🟧 Desafio privado exige código de acesso
      if ((result as any).requiresAccessCode) {
        return res.status(403).json({
          success: false,
          requiresAccessCode: true,
          invalidAccessCode: (result as any).invalidAccessCode || false,
          message: (result as any).message,
        });
      }

      // 🟥 Validação falhou (não atende aos critérios)
      if ((result as any).validationFailed) {
        return res.status(403).json({
          success: false,
          validationFailed: true,
          errors: (result as any).errors,
          message: (result as any).message,
        });
      }

      if ((result as any).challengeStarted) {
        return res.status(400).json({
          success: false,
          challengeStarted: true,
          message: (result as any).message || "Desafio já iniciado. Não é permitido a entrada de novos participantes.",
        });
      }

      if ((result as any).challengeEnded) {
        return res.status(410).json({
          success: false,
          challengeEnded: true,
          message: (result as any).message || "Este desafio já foi concluído e não aceita mais participantes.",
        });
      }

      // 🟥 Requer pagamento
      if (result.requiresPayment) {
        return res.status(402).json({
          success: false,
          requiresPayment: true,
          price: result.price,
          message: result.message,
        });
      }

      // 🟨 Já participa
      if ((result as any).challengeCancelled) {
        return res.status(409).json({
          success: false,
          challengeCancelled: true,
          message: (result as any).message || "Este desafio foi cancelado e nÃ£o aceita novas entradas.",
        });
      }

      if (result.already) {
        return res.json({
          success: true,
          message: "Você já está participando deste desafio",
          data: result.participant,
        });
      }

      // 🟩 Entrou
      return res.json({
        success: true,
        message: "Participação registrada com sucesso",
        data: result.participant,
      });

    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ DETALHES DO DESAFIO
  // ================================
  static async getDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const challengeId = req.params.id;
      if (!challengeId) {
        return res.status(400).json({ success: false, message: "ID do desafio não fornecido" });
      }

      const data = await ChallengesService.getDetails(challengeId, req.userId);
      
      if (!data) {
        return res.status(404).json({ success: false, message: "Desafio não encontrado" });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return next(error);
    }
  }


  // ================================
  // ✔️ FINALIZAR DESAFIO — ADICIONADO AGORA
  // ================================
  static async completeChallenge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const challengeId = req.params.challengeId;

      const result = await ChallengesService.completeChallenge(req.userId, challengeId);

      return res.json({
        success: true,
        message: result.message,
        reward: result.reward,
      });

    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ EXCLUIR DESAFIO
  // ================================
  static async deleteChallenge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const challengeId = req.params.id;

      const result = await ChallengesService.deleteChallenge(challengeId, req.userId);

      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        if ((result as any).reason === "already_completed") {
          return res.status(409).json({
            success: false,
            message: "Este desafio jÃ¡ foi concluÃ­do e nÃ£o pode ser cancelado",
          });
        }

        if ((result as any).reason === "already_cancelled") {
          return res.status(409).json({
            success: false,
            message: "Este desafio jÃ¡ foi cancelado",
          });
        }

        if ((result as any).reason === "already_started") {
          return res.status(409).json({
            success: false,
            challengeStarted: true,
            message: "Após o início do desafio o criador não pode mais excluí-lo.",
          });
        }
      }

      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        if ((result as any).reason === "has_participants") {
          return res.status(400).json({
            success: false,
            message: "Não é possível cancelar: já existem participantes no desafio. O cancelamento só é permitido antes da entrada de qualquer participante.",
          });
        }
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para excluir este desafio ou desafio não encontrado.",
        });
      }
      if (!result) {
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para excluir este desafio",
        });
      }

      return res.json({
        success: true,
        message:
          (result as any).mode === "deleted"
            ? "Desafio excluÃ­do com sucesso"
            : "Desafio cancelado com sucesso",
        data:
          (result as any).mode === "cancelled"
            ? {
                status: "cancelled",
                notifiedParticipants: (result as any).participantCount ?? 0,
              }
            : {
                status: "deleted",
              },
      });

    } catch (error) {
      return next(error);
    }
  }

  static async cancelChallenge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "NÃ£o autenticado" });
      }

      const challengeId = req.params.id;
      if (!challengeId) {
        return res.status(400).json({ success: false, message: "ID do desafio nÃ£o fornecido" });
      }

      const result = await ChallengesService.cancelChallenge(challengeId, req.userId);

      if (!result.ok) {
        if (result.reason === "not_found") {
          return res.status(404).json({ success: false, message: "Desafio nÃ£o encontrado" });
        }

        if (result.reason === "forbidden") {
          return res.status(403).json({
            success: false,
            message: "Apenas o criador do desafio pode cancelar este desafio",
          });
        }

        if (result.reason === "already_cancelled") {
          return res.status(409).json({
            success: false,
            message: "Este desafio jÃ¡ foi cancelado",
          });
        }

        if (result.reason === "already_completed") {
          return res.status(409).json({
            success: false,
            message: "Este desafio jÃ¡ foi concluÃ­do e nÃ£o pode ser cancelado",
          });
        }

        if (result.reason === "already_started") {
          return res.status(409).json({
            success: false,
            challengeStarted: true,
            message: "Após o início do desafio o criador não pode mais excluí-lo.",
          });
        }
      }

      return res.json({
        success: true,
        message: "Desafio cancelado com sucesso",
        data: {
          challengeId: result.challengeId,
          notifiedParticipants: result.participantCount,
          status: "cancelled",
          supportsParticipantCancellation: true,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateChallenge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "NÃ£o autenticado" });
      }

      const challengeId = req.params.id;
      if (!challengeId) {
        return res.status(400).json({ success: false, message: "ID do desafio invÃ¡lido" });
      }

      const result = await ChallengesService.updateChallenge(challengeId, req.userId, req.body);

      if (!result.ok) {
        if (result.reason === "not_found_or_forbidden") {
          return res.status(403).json({
            success: false,
            message: "Apenas o criador do desafio pode editar este desafio",
          });
        }

        if (result.reason === "already_cancelled") {
          return res.status(409).json({
            success: false,
            message: "Este desafio jÃ¡ foi cancelado e nÃ£o pode ser editado",
          });
        }

        if (result.reason === "already_completed") {
          return res.status(409).json({
            success: false,
            message: "Este desafio jÃ¡ foi concluÃ­do e nÃ£o pode ser editado",
          });
        }

        if (result.reason === "invalid_start_time") {
          return res.status(400).json({
            success: false,
            message: "Formato de horÃ¡rio inicial invÃ¡lido. Use HH:MM",
          });
        }

        if (result.reason === "invalid_end_time") {
          return res.status(400).json({
            success: false,
            message: "Formato de horÃ¡rio final invÃ¡lido. Use HH:MM",
          });
        }

        if (result.reason === "incomplete_time_window") {
          return res.status(400).json({
            success: false,
            message: "Se fornecer horÃ¡rios, envie horÃ¡rio inicial e final",
          });
        }

        if (result.reason === "invalid_time_window") {
          return res.status(400).json({
            success: false,
            message: "O horÃ¡rio final deve ser posterior ao horÃ¡rio inicial",
          });
        }
      }

      return res.json({
        success: true,
        message: "Desafio atualizado com sucesso",
        data: result.challenge,
      });
    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ META DE PERDA DE PESO (Modo Balança)
  // GET /api/challenges/weight-goal?durationWeeks=12&currentWeight=80
  // ================================
  static async getWeightGoal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const durationWeeks = parseInt(req.query.durationWeeks as string);
      const currentWeight = parseFloat(req.query.currentWeight as string);

      if (isNaN(durationWeeks) || isNaN(currentWeight) || durationWeeks <= 0 || currentWeight <= 0) {
        return res.status(400).json({ success: false, message: "durationWeeks e currentWeight são obrigatórios e devem ser positivos" });
      }

      const result = ChallengesService.calculateWeightGoal(currentWeight, durationWeeks);

      return res.json({
        success: true,
        data: {
          currentWeightKg: currentWeight,
          durationWeeks,
          goalWeightKg: result.goalWeightKg,
          goalPercent: result.goalPercent,
          weightToLoseKg: parseFloat((currentWeight - result.goalWeightKg).toFixed(1)),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}
