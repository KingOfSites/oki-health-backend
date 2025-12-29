import { Request, Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";

export class WalletController {

  // GET /api/wallet
  static async getWallet(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          balance: true,
          total_earned: true,
          total_withdrawn: true,
          xp: true,
          level: true,
        },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      // Retornar valores diretamente como Float (reais) conforme o schema
      return res.json({
        balance: user.balance ?? 0,
        total_earned: user.total_earned ?? 0,
        total_withdrawn: user.total_withdrawn ?? 0,
        xp: user.xp ?? 0,
        level: user.level ?? 1,
      });

    } catch (err) {
      console.error("[Wallet.getWallet]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // GET /api/wallet/:userId
  static async getUserTokenWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const rows = await prisma.transaction.findMany({
        where: { userId }, // ✔ CORRETO
        orderBy: { created_at: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          type: true,
          created_at: true,
        },
      });

      return res.json(rows);

    } catch (err) {
      console.error("[Wallet.getUserTokenWallet]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST /api/wallet/deposit
  static async deposit(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount,
          type: "deposit",
          status: "completed",
          description: `Depósito de R$ ${amount.toFixed(2)}`,
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          total_earned: { increment: amount },
        },
      });

      return res.json({ success: true, id: transaction.id });

    } catch (err) {
      console.error("[Wallet.deposit]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // GET /api/wallet/transactions
  static async getTransactions(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { created_at: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          status: true,
          created_at: true,
        },
      });

      return res.json(transactions);

    } catch (err) {
      console.error("[Wallet.getTransactions]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST /api/wallet/withdraw
  static async withdraw(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.balance < amount) {
        return res.status(400).json({ error: "Saldo insuficiente" });
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount,
          type: "withdraw",
          status: "completed",
          description: `Saque de R$ ${amount.toFixed(2)}`,
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          total_withdrawn: { increment: amount },
        },
      });

      return res.json({ success: true, id: transaction.id });

    } catch (err) {
      console.error("[Wallet.withdraw]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
