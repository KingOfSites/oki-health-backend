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
}
