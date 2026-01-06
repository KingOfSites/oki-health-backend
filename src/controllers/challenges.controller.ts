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
      } = req.body;

      if (!title || !description || !category || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Campos obrigatórios: title, description, category, startDate, endDate",
        });
      }

      const data = await ChallengesService.createChallenge({
        createdById: req.userId,
        title,
        description,
        category,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reward: reward || 0,
        location,
        coverUrl,
        entryPriceCents: entryPriceCents || 0,
        maxParticipants,
        firstPlacePrizeCents: firstPlacePrizeCents || 0,
        secondPlacePrizeCents: secondPlacePrizeCents || 0,
        thirdPlacePrizeCents: thirdPlacePrizeCents || 0,
        minAge: minAge ? parseInt(minAge) : null,
        minWeight: minWeight ? parseFloat(minWeight) : null,
        maxWeight: maxWeight ? parseFloat(maxWeight) : null,
        requiredActivityLevel: requiredActivityLevel || null,
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

      // 🟥 Desafio já terminou
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

      const deleted = await ChallengesService.deleteChallenge(challengeId, req.userId);

      if (!deleted) {
        return res.status(403).json({
          success: false,
          message: "Você não tem permissão para excluir este desafio",
        });
      }

      return res.json({ success: true, message: "Desafio excluído com sucesso" });

    } catch (error) {
      return next(error);
    }
  }
}
