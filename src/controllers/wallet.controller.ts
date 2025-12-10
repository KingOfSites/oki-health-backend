import { Request, Response } from "express";
import prisma from "../config/database";
import crypto from "crypto";

export class WalletController {

  // GET /api/wallet
  static async getWallet(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
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
        balance: Math.round((user.balance ?? 0) * 100),
        total_earned: Math.round((user.total_earned ?? 0) * 100),
        total_withdrawn: Math.round((user.total_withdrawn ?? 0) * 100),
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
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      const id = crypto.randomUUID();

      await prisma.transaction.create({
        data: {
          id,
          userId, // ✔ CORRETO
          amount,
          type: "deposit",
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          total_earned: { increment: amount },
        },
      });

      return res.json({ success: true, id });

    } catch (err) {
      console.error("[Wallet.deposit]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST /api/wallet/withdraw
  static async getTransactions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
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

      const id = crypto.randomUUID();

      await prisma.transaction.create({
        data: {
          id,
          userId, // ✔ CORRETO
          amount,
          type: "withdraw",
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          total_withdrawn: { increment: amount },
        },
      });

      return res.json({ success: true, id });

    } catch (err) {
      console.error("[Wallet.withdraw]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
