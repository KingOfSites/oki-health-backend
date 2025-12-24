import { Request, Response, NextFunction } from "express";
import { AffiliateService } from "../services/affiliate.service";
import { AuthRequest } from "../middleware/auth";

export class AffiliateController {
  // Obter estatísticas do afiliado
  static async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const stats = await AffiliateService.getAffiliateStats(req.userId);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Obter link de afiliado
  static async getLink(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const baseUrl = process.env.FRONTEND_URL || "https://oki.health";
      const link = await AffiliateService.getAffiliateLink(req.userId, baseUrl);

      return res.status(200).json({
        success: true,
        data: { link },
      });
    } catch (error) {
      return next(error);
    }
  }

  // Registrar código de afiliado
  static async registerCode(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const { code } = req.body;

      if (!code || typeof code !== "string" || code.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Código de afiliado é obrigatório",
        });
      }

      const result = await AffiliateService.registerAffiliateCode(req.userId, code);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.message) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      return next(error);
    }
  }
}

