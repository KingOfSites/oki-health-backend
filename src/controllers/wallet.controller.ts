import { Request, Response } from "express";
import prisma from "../config/database";

export class WalletController {
  /**
   * GET /api/wallet
   * Retorna a carteira em reais (centavos)
   */
  static async getWallet(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          balance: true,
          total_earned: true,
          total_withdrawn: true,
        },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        balance: Math.round(user.balance * 100),
        total_earned: Math.round((user.total_earned ?? 0) * 100),
        total_withdrawn: Math.round((user.total_withdrawn ?? 0) * 100),

      });

    } catch (err) {
      console.error("[WalletController.getWallet] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * GET /api/wallet/:userId
   * Retorna os TOKENS (não reais)
   */
  static async getUserTokenWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          balance: true,
          total_earned: true,
          total_withdrawn: true,
        },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        tokens: user.balance,
        totalEarned: user.total_earned,
        totalWithdrawn: user.total_withdrawn,
      });

    } catch (err) {
      console.error("[WalletController.getUserTokenWallet] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * GET /api/wallet/transactions
   */
  static async getTransactions(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const transactions = await prisma.transaction.findMany({
        where: { user_id: userId },  // <-- CORRETO!!!
        orderBy: { created_at: "desc" },
      });

      const formatted = transactions.map((t) => ({
        id: t.id,
        amount_centavos: Math.round(t.amount * 100),
        transaction_type: t.type,
        description: t.description ?? null,
        created_at: t.created_at,
        status: t.status ?? "completed",
      }));

      return res.json(formatted);

    } catch (err) {
      console.error("[WalletController.getTransactions] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
