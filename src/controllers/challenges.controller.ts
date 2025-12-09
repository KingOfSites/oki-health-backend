import { Request, Response, NextFunction } from "express";
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
      res.json({ success: true, data });

    } catch (error) {
      next(error);
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
      res.json({ success: true, data });

    } catch (error) {
      next(error);
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

      res.status(201).json({ success: true, data });

    } catch (error) {
      next(error);
    }
  }

  // ================================
  // ✔️ LISTAR TODOS OS DESAFIOS
  // ================================
  static async searchChallenges(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { location, filter } = req.query;
  
      if (!location || !filter) {
        return res.status(400).json({
          success: false,
          message: "Parâmetros 'location' e 'filter' são obrigatórios",
        });
      }
  
      const challenges = await prisma.challenge.findMany({
        where: {
          location: {
            contains: String(location),
          },
        },
        include: {
          participants: true,
        },
      });
  
      return res.json({
        success: true,
        challenges,
      });
    } catch (error) {
      next(error);
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
      next(error);
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

      res.json({ success: true, data });

    } catch (error) {
      next(error);
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

      res.json({ success: true, message: "Desafio excluído com sucesso" });

    } catch (error) {
      next(error);
    }
  }
}
