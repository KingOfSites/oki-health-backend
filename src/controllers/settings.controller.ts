import { Request, Response, NextFunction } from "express";
import { SettingsService } from "../services/settings.service";
import { AuthRequest } from "../middleware/auth";

export class SettingsController {
  // Obter configurações
  static async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const settings = await SettingsService.getSettings(req.userId);

      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Atualizar configurações
  static async updateSettings(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const { darkMode, notifications } = req.body;

      const updated = await SettingsService.updateSettings(req.userId, {
        darkMode,
        notifications,
      });

      return res.status(200).json({
        success: true,
        message: "Configurações atualizadas com sucesso",
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Atualizar senha
  static async updatePassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Senha atual e nova senha são obrigatórias",
        });
      }

      const result = await SettingsService.updatePassword(
        req.userId,
        currentPassword,
        newPassword
      );

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      return next(error);
    }
  }
}

