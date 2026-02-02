import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";

/**
 * Stub de notificações: retorna lista vazia e aceita marcar como lidas.
 * O app não quebra; futuramente pode ser substituído por modelo Notification no Prisma.
 */
export class NotificationsController {
  static async getNotifications(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      // Stub: sem tabela de notificações, retorna array vazio (limit ignorado por enquanto)
      return res.status(200).json({
        success: true,
        data: [],
      });
    } catch (error) {
      return _next(error);
    }
  }

  static async markAsRead(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      // Stub: aceita a requisição para não quebrar o app
      return res.status(200).json({ success: true });
    } catch (error) {
      return _next(error);
    }
  }

  static async markAllAsRead(
    req: AuthRequest,
    res: Response,
    _next: NextFunction
  ) {
    try {
      return res.status(200).json({ success: true });
    } catch (error) {
      return _next(error);
    }
  }
}
