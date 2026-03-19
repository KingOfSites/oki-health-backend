import { Request, Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";
import * as fs from "fs";
import * as path from "path";

// Arquivo de configurações administrativas (persiste em disco)
const SETTINGS_PATH = path.join(process.cwd(), "admin-settings.json");

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
    }
  } catch {}
  return { affiliateCommissionRate: 0.15, adminFeeRate: 0.05, proPlanPrice: 29.9 };
}

function saveSettings(data: object) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

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

  // GET /api/admin/challenges
  static async getChallenges(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      const admin = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      if (!admin?.isAdmin) return res.status(403).json({ success: false, message: "Acesso negado." });

      const challenges = await (prisma.challenge as any).findMany({
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          title: true,
          category: true,
          mode: true,
          prizeDistributionType: true,
          startDate: true,
          endDate: true,
          entryPriceCents: true,
          firstPlacePrizeCents: true,
          secondPlacePrizeCents: true,
          thirdPlacePrizeCents: true,
          isPublic: true,
          createdBy: { select: { id: true, name: true, isPro: true } },
          _count: { select: { participants: true } },
        },
      });

      return res.json({ success: true, data: challenges });
    } catch (err) {
      console.error("[Admin.getChallenges]", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // GET /api/admin/proof-moderation
  static async getRejectedProofs(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      const admin = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      if (!admin?.isAdmin) return res.status(403).json({ success: false, message: "Acesso negado." });

      const { status = "rejected" } = req.query;

      const proofs = await prisma.$queryRawUnsafe(
        `SELECT cc.id, cc.challengeId, cc.userId, cc.message, cc.imageUrl, cc.verificationStatus,
                cc.verificationReason, cc.created_at,
                u.name as user_name, u.avatar_url,
                c.title as challenge_title
         FROM challenge_chat cc
         JOIN users u ON cc.userId = u.id
         JOIN challenges c ON cc.challengeId = c.id
         WHERE cc.imageUrl IS NOT NULL AND cc.verificationStatus = ?
         ORDER BY cc.created_at DESC
         LIMIT 100`,
        status
      ) as any[];

      return res.json({ success: true, data: proofs });
    } catch (err) {
      console.error("[Admin.getRejectedProofs]", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // PUT /api/admin/proof-moderation/:id/approve
  static async approveProofManually(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      const admin = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      if (!admin?.isAdmin) return res.status(403).json({ success: false, message: "Acesso negado." });

      const { id } = req.params;

      await prisma.$executeRawUnsafe(
        `UPDATE challenge_chat SET verificationStatus = 'verified', verifiedAt = NOW(), verificationReason = 'Aprovado manualmente pelo administrador' WHERE id = ?`,
        id
      );

      // Adicionar 1 ponto ao participante se ainda não recebeu hoje
      const proof = await prisma.$queryRawUnsafe(
        `SELECT userId, challengeId FROM challenge_chat WHERE id = ?`, id
      ) as any[];

      if (proof[0]) {
        const { userId: proofUserId, challengeId } = proof[0];
        const alreadyPointed = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as cnt FROM challenge_chat WHERE userId = ? AND challengeId = ? AND verificationStatus = 'verified' AND DATE(verifiedAt) = CURDATE() AND id != ?`,
          proofUserId, challengeId, id
        ) as any[];
        if ((alreadyPointed[0]?.cnt ?? 0) === 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE challenge_participants SET points = points + 1 WHERE userId = ? AND challengeId = ?`,
            proofUserId, challengeId
          );
        }
      }

      return res.json({ success: true, message: "Prova aprovada manualmente." });
    } catch (err) {
      console.error("[Admin.approveProofManually]", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // GET /api/admin/settings
  static async getSettings(_req: Request, res: Response) {
    return res.json({ success: true, data: loadSettings() });
  }

  // PUT /api/admin/settings
  static async updateSettings(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      const admin = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      if (!admin?.isAdmin) return res.status(403).json({ success: false, message: "Acesso negado." });

      const current = loadSettings();
      const { affiliateCommissionRate, adminFeeRate, proPlanPrice } = req.body;

      const updated = {
        affiliateCommissionRate: affiliateCommissionRate != null ? Number(affiliateCommissionRate) : current.affiliateCommissionRate,
        adminFeeRate: adminFeeRate != null ? Number(adminFeeRate) : current.adminFeeRate,
        proPlanPrice: proPlanPrice != null ? Number(proPlanPrice) : current.proPlanPrice,
      };

      saveSettings(updated);
      return res.json({ success: true, data: updated });
    } catch (err) {
      console.error("[Admin.updateSettings]", err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}
