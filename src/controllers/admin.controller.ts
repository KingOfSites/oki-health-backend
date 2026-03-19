import { Request, Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";

export class AdminController {
  // GET /api/admin/dashboard
  static async getDashboard(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // Verificar se é admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!user || !user.isAdmin) {
        return res
          .status(403)
          .json({ success: false, message: "Acesso negado. Apenas administradores." });
      }

      // Estatísticas gerais
      const totalUsers = await prisma.user.count();

      const usersStats = await prisma.user.aggregate({
        _sum: {
          balance: true,
          total_earned: true,
          total_withdrawn: true,
        },
      });

      const withdrawalStats = await prisma.withdrawalRequest.groupBy({
        by: ["status"],
        _count: {
          id: true,
        },
      });

      const activeUsers = await prisma.user.count({
        where: {
          balance: {
            gt: 0,
          },
        },
      });

      const proUsers = await prisma.user.count({
        where: {
          isPro: true,
        },
      });

      const data = {
        totalUsers,
        totalBalance: usersStats._sum.balance || 0,
        totalEarned: usersStats._sum.total_earned || 0,
        totalWithdrawn: usersStats._sum.total_withdrawn || 0,

        pendingWithdrawals:
          withdrawalStats.find((s) => s.status === "pending")?._count.id || 0,
        approvedWithdrawals:
          withdrawalStats.find((s) => s.status === "approved")?._count.id || 0,
        rejectedWithdrawals:
          withdrawalStats.find((s) => s.status === "rejected")?._count.id || 0,
        completedWithdrawals:
          withdrawalStats.find((s) => s.status === "completed")?._count.id || 0,

        activeUsers,
        proUsers,
      };

      return res.json({
        success: true,
        data,
      });
    } catch (err) {
      console.error("[Admin.getDashboard]", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // GET /api/admin/users
  static async getUsers(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!user || !user.isAdmin) {
        return res
          .status(403)
          .json({ success: false, message: "Acesso negado. Apenas administradores." });
      }

      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          nickname: true,
          email: true,
          balance: true,
          total_earned: true,
          total_withdrawn: true,
          xp: true,
          level: true,
          isPro: true,
          created_at: true,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return res.json({
        success: true,
        data: users,
      });
    } catch (err) {
      console.error("[Admin.getUsers]", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // GET /api/admin/withdrawal-requests
  static async getWithdrawalRequests(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!user || !user.isAdmin) {
        return res
          .status(403)
          .json({ success: false, message: "Acesso negado. Apenas administradores." });
      }

      const { status } = req.query;

      const where: any = {};
      if (status && status !== "all") {
        where.status = status;
      }

      const requests = await prisma.withdrawalRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              balance: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return res.json({
        success: true,
        data: requests,
      });
    } catch (err) {
      console.error("[Admin.getWithdrawalRequests]", err);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}
