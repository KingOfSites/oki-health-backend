import { Request, Response, NextFunction } from "express";
import { AffiliateService } from "../services/affiliate.service";
import { AuthRequest } from "../middleware/auth";

export class AffiliateController {
  // Verificar se o usuário é premium
  static async checkPremium(userId: string): Promise<boolean> {
    const prisma = (await import("../config/database")).default;
    const rawQuery = await prisma.$queryRaw<Array<{ isPro: number }>>`
      SELECT isPro FROM users WHERE id = ${userId}
    `;
    const rawIsPro = rawQuery[0]?.isPro;
    return rawIsPro === true || rawIsPro === 1 || Number(rawIsPro) === 1;
  }

  // Obter estatísticas do afiliado
  static async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      // Verificar se é premium
      const isPremium = await AffiliateController.checkPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          success: false,
          message: "Apenas usuários premium podem acessar o programa de afiliados",
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

      // Verificar se é premium
      const isPremium = await AffiliateController.checkPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          success: false,
          message: "Apenas usuários premium podem acessar o programa de afiliados",
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

      // Verificar se é premium
      const isPremium = await AffiliateController.checkPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          success: false,
          message: "Apenas usuários premium podem acessar o programa de afiliados",
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

  // Listar indicações
  static async getReferrals(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      // Verificar se é premium
      const isPremium = await AffiliateController.checkPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          success: false,
          message: "Apenas usuários premium podem acessar o programa de afiliados",
        });
      }

      const { status, source, limit, offset } = req.query;

      const filters: any = {};
      if (status) filters.status = status as string;
      if (source) filters.source = source as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const result = await AffiliateService.getReferrals(req.userId, filters);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Obter histórico de pagamentos
  static async getPaymentHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      // Verificar se é premium
      const isPremium = await AffiliateController.checkPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          success: false,
          message: "Apenas usuários premium podem acessar o programa de afiliados",
        });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const result = await AffiliateService.getPaymentHistory(req.userId, limit, offset);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Obter estatísticas detalhadas
  static async getDetailedStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      // Verificar se é premium
      const isPremium = await AffiliateController.checkPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          success: false,
          message: "Apenas usuários premium podem acessar o programa de afiliados",
        });
      }

      const stats = await AffiliateService.getDetailedStats(req.userId);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  }
}

