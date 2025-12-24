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
    const { location } = req.query;

      // Se location for "all" ou vazio, retornar todos os desafios
      if (location === "all" || !location) {
        const userId = req.userId; // Pode ser undefined se não autenticado
        const challenges = await prisma.challenge.findMany({
          include: {
            participants: true,
          },
          orderBy: {
            created_at: "desc",
          },
        });

        return res.json({
          success: true,
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
        include: {
          participants: true,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return res.json({
        success: true,
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
static async getDetails(challengeId: string, userId: string) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: true,
      createdBy: true,
    },
  });

  if (!challenge) return null;

  const alreadyJoined = challenge.participants.some(
    (p) => p.userId === userId
  );

  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    reward: challenge.reward,
    location: challenge.location,
    entryPriceCents: challenge.entryPriceCents,

    participants: challenge.participants.map((p) => ({
      userId: p.userId,
    })),

    alreadyJoined,
    createdBy: {
      name: challenge.createdBy?.name || "Criador",
    },

    status: challenge.status,
  };
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
