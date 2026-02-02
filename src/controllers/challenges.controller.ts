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
        creatorParticipates,
      } = req.body;
      
      console.log("📥 [Create Challenge] Horários extraídos do body:", {
        startTime,
        endTime,
        startTimeType: typeof startTime,
        endTimeType: typeof endTime,
        startTimeExists: startTime !== undefined,
        endTimeExists: endTime !== undefined,
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
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      // Calcular diferença em dias
      const diffTime = startDateObj.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      // A data deve ser pelo menos 1 dia no futuro (amanhã ou depois)
      if (diffDays < 1) {
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
      if (startTime !== null && startTime !== undefined && startTime !== '') {
        if (typeof startTime === 'string' && startTime.trim()) {
          processedStartTime = startTime.trim();
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
      if (endTime !== null && endTime !== undefined && endTime !== '') {
        if (typeof endTime === 'string' && endTime.trim()) {
          processedEndTime = endTime.trim();
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
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
        frequency: frequency || "daily",
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
          orderBy: {
            created_at: "desc",
          },
        });

        return res.json({
          success: true,
          data: {
            challenges: challenges.map((c) => ({
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
              participants_count: c.participants.length,
              is_participant: userId ? c.participants.some((p) => p.userId === userId) : false,
            })),
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
        orderBy: {
          created_at: "desc",
        },
      });

      return res.json({
        success: true,
        data: {
          challenges: challenges.map((c) => ({
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
            participants_count: c.participants.length,
            is_participant: userId ? c.participants.some((p) => p.userId === userId) : false,
          })),
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

      const result = await ChallengesService.joinChallenge(req.userId, challengeId);

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
          message: (result as any).message || "Após o início do desafio não é permitida a entrada de novos participantes.",
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

      return res.json({ success: true, message: "Desafio cancelado com sucesso" });

    } catch (error) {
      return next(error);
    }
  }
}
