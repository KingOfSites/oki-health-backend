import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { ChallengesService } from "../services/challenges.service";

export class ChallengesController {
  static async listMyChallenges(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res
          .status(401)
          .json({ success: false, message: "Não autenticado" });
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
        return res
          .status(401)
          .json({ success: false, message: "Não autenticado" });
      }
      const data = await ChallengesService.listCreatedChallenges(req.userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async createChallenge(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res
          .status(401)
          .json({ success: false, message: "Não autenticado" });
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
          message:
            "Campos obrigatórios: title, description, category, startDate, endDate",
        });
      }

      if (entryPriceCents < 0) {
        return res.status(400).json({
          success: false,
          message: "Valor de entrada deve ser positivo",
        });
      }

      const data = await ChallengesService.createChallenge({
        createdById: req.userId,
        title,
        description: description || "",
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

  static async listAllChallenges(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await ChallengesService.listAllChallenges();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // ✅ NOVO — deletar desafio do banco real
  static async deleteChallenge(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res
          .status(401)
          .json({ success: false, message: "Não autenticado" });
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
