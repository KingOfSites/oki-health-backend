import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { ChallengesService } from "../services/challenges.service";
import prisma from "../config/database";

export class ChallengesController {

  // ================================
  // ✔️ DESAFIOS DO USUÁRIO
  // ================================
  static async listMyChallenges(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
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

  static async listCreatedChallenges(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
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
  static async createChallenge(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
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
  // ✔️ LISTAR TODOS OS DESAFIOS
  // ================================
  static async searchChallenges(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { location, filter } = req.query;

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
  // ✔️ ENTRAR EM UM DESAFIO
  // ================================
  static async joinChallenge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const challengeId = req.params.challengeId;
      const result = await ChallengesService.joinChallenge(req.userId, challengeId);

      return res.json({
        success: true,
        message: "Participação registrada",
        data: result,
      });

    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ GET DETAILS
  // ================================
  static async getDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const challengeId = req.params.id;

      const data = await ChallengesService.getDetails(challengeId, userId);

      return res.json({ success: true, data });

    } catch (error) {
      return next(error);
    }
  }

  // ================================
  // ✔️ EXCLUIR DESAFIO
  // ================================
  static async deleteChallenge(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
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
