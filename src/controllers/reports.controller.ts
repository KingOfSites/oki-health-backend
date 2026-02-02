import { Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";

export class ReportsController {
  static async createReport(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const { targetType, targetId, reason } = req.body;
      if (!targetType || !targetId) {
        return res.status(400).json({
          success: false,
          message: "targetType e targetId são obrigatórios (message, user ou post)",
        });
      }
      const validTypes = ["message", "user", "post"];
      if (!validTypes.includes(targetType)) {
        return res.status(400).json({
          success: false,
          message: "targetType deve ser: message, user ou post",
        });
      }

      const report = await prisma.report.create({
        data: {
          reporterId: userId,
          targetType,
          targetId,
          reason: reason || null,
          status: "pending",
        },
      });

      return res.status(201).json({
        success: true,
        message: "Denúncia registrada. Nossa equipe analisará em breve. Para casos urgentes, entre em contato pelo e-mail de suporte.",
        data: { id: report.id },
      });
    } catch (error: any) {
      console.error("[Reports] Erro ao criar denúncia:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao registrar denúncia",
      });
    }
  }
}
