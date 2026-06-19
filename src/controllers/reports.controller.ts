import { Response } from "express";
import { AuthRequest } from "../middleware/auth";

export class ReportsController {
  static async createReport(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const { targetType, targetId } = req.body;
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

      // O modelo Report ainda não existe no schema do Prisma.
      // Mantemos a rota estável para o app enquanto o armazenamento definitivo não é implementado.
      return res.status(202).json({
        success: true,
        message: "Denúncia recebida para processamento",
        data: {
          id: `pending:${targetType}:${targetId}:${Date.now()}`,
          status: "pending",
        },
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
