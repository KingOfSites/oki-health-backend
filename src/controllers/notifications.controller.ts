import { Response, NextFunction } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";

export class NotificationsController {
  static async getNotifications(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "NÃ£o autenticado" });
      }

      const notifications = await prisma.notification.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async markAsRead(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "NÃ£o autenticado" });
      }

      await prisma.notification.updateMany({
        where: {
          id: req.params.id,
          userId: req.userId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  static async markAllAsRead(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "NÃ£o autenticado" });
      }

      await prisma.notification.updateMany({
        where: {
          userId: req.userId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
}
