import { Request, Response } from "express";
import db from "../config/database"; // PrismaClient
import crypto from "crypto";

export class WalletController {
  /**
   * GET /api/wallet
   * Retorna saldo e totais do usuário logado
   */
  static async getWallet(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          balance: true,
          total_earned: true,
          total_withdrawn: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.json({
        balance: user.balance ?? 0,
        total_earned: user.total_earned ?? 0,
        total_withdrawn: user.total_withdrawn ?? 0,
      });

    } catch (err) {
      console.error("[WalletController.getWallet] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * GET /api/wallet/transactions
   */
  static async getTransactions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const rows = await db.transaction.findMany({
        where: { userId },
        orderBy: { created_at: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          type: true,
          created_at: true,
        }
      });

      return res.json(rows);

    } catch (err) {
      console.error("[WalletController.getTransactions] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * POST /api/wallet/deposit
   */
  static async deposit(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { amount } = req.body as { amount: number };

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      const id = crypto.randomUUID();

      // registra transação
      await db.transaction.create({
        data: {
          id,
          userId,
          amount,
          type: "deposit",
        },
      });

      // atualiza usuário
      await db.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          total_earned: { increment: amount },
        },
      });

      return res.json({ success: true, id });

    } catch (err) {
      console.error("[WalletController.deposit] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * POST /api/wallet/withdraw
   */
  static async withdraw(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { amount } = req.body as { amount: number };

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const balance = user.balance ?? 0;

      if (balance < amount) {
        return res.status(400).json({ error: "Saldo insuficiente" });
      }

      const id = crypto.randomUUID();

      // cria transação de saque
      await db.transaction.create({
        data: {
          id,
          userId,
          amount,
          type: "withdraw",
        },
      });

      // atualiza saldo e total sacado
      await db.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          total_withdrawn: { increment: amount },
        },
      });

      return res.json({ success: true, id });

    } catch (err) {
      console.error("[WalletController.withdraw] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
