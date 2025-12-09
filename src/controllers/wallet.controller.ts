import { Request, Response } from "express";
import db from "../config/database"; // 👉 CORRIGIDO
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

      const [rows]: any = await db.query(
        "SELECT balance, total_earned, total_withdrawn FROM users WHERE id = ?",
        [userId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = rows[0];

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

      const [rows]: any = await db.query(
        "SELECT id, amount, type, description, status, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        [userId]
      );

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
      await db.query(
        "INSERT INTO transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, 'deposit', ?, 'approved')",
        [id, userId, amount, "Depósito de tokens"]
      );

      // atualiza usuário
      await db.query(
        "UPDATE users SET balance = balance + ?, total_earned = total_earned + ? WHERE id = ?",
        [amount, amount, userId]
      );

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

      // checar saldo
      const [rows]: any = await db.query(
        "SELECT balance FROM users WHERE id = ?",
        [userId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const balance = rows[0].balance ?? 0;

      if (balance < amount) {
        return res.status(400).json({ error: "Saldo insuficiente" });
      }

      const id = crypto.randomUUID();

      // cria transação de saque
      await db.query(
        "INSERT INTO transactions (id, user_id, amount, type, description, status) VALUES (?, ?, ?, 'withdraw', ?, 'pending')",
        [id, userId, amount, "Saque solicitado"]
      );

      // atualiza saldo e total sacado
      await db.query(
        "UPDATE users SET balance = balance - ?, total_withdrawn = total_withdrawn + ? WHERE id = ?",
        [amount, amount, userId]
      );

      return res.json({ success: true, id });
    } catch (err) {
      console.error("[WalletController.withdraw] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
