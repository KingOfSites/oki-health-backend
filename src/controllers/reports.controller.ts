import { Response } from "express";
import { AuthRequest } from "../middleware/auth";

export class ReportsController {
  static async createReport(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "NÃ£o autenticado" });
      }

      const { targetType, targetId } = req.body;
      if (!targetType || !targetId) {
        return res.status(400).json({
          success: false,
          message: "targetType e targetId sÃ£o obrigatÃ³rios (message, user ou post)",
        });
      }

      const validTypes = ["message", "user", "post"];
      if (!validTypes.includes(targetType)) {
        return res.status(400).json({
          success: false,
          message: "targetType deve ser: message, user ou post",
        });
      }

      // O modelo Report ainda nÃ£o existe no schema do Prisma.
      // Mantemos a rota estÃ¡vel para o app enquanto o armazenamento definitivo nÃ£o Ã© implementado.
      return res.status(202).json({
        success: true,
        message: "DenÃºncia recebida para processamento",
        data: {
          id: `pending:${targetType}:${targetId}:${Date.now()}`,
          status: "pending",
        },
      });
    } catch (error: any) {
      console.error("[Reports] Erro ao criar denÃºncia:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao registrar denÃºncia",
      });
    }
  }
}
