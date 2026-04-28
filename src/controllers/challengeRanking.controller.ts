import { Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { PrizeDistributionService } from "../services/prizeDistribution.service";

export class ChallengeRankingController {
  // ================================
  // 🔥 OBTER RANKING DO DESAFIO
  // ================================
  static async getRanking(req: AuthRequest, res: Response) {
    try {
      const { challengeId } = req.params;
      const userId = req.userId;

      if (!challengeId) {
        return res.status(400).json({
          success: false,
          message: "ID do desafio não fornecido",
        });
      }

      // Buscar desafio
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
        select: {
          id: true,
          title: true,
          firstPlacePrizeCents: true,
          secondPlacePrizeCents: true,
          thirdPlacePrizeCents: true,
          endDate: true,
          endTime: true,
          status: true,
          createdById: true,
        },
      });

      if (!challenge) {
        return res.status(404).json({
          success: false,
          message: "Desafio não encontrado",
        });
      }

      // Buscar participantes ordenados por pontos (maior para menor)
      const participants = await prisma.$queryRawUnsafe(
        `SELECT 
          cp.id,
          cp.userId,
          cp.points,
          cp.joinedAt,
          u.name as user_name,
          u.avatar_url,
          COUNT(CASE WHEN cc.verificationStatus = 'verified' THEN 1 END) as verified_count
         FROM challenge_participants cp
         JOIN users u ON cp.userId = u.id
         LEFT JOIN challenge_chat cc ON cc.userId = cp.userId AND cc.challengeId = cp.challengeId
         WHERE cp.challengeId = ?
         GROUP BY cp.id, cp.userId, cp.points, cp.joinedAt, u.name, u.avatar_url
         ORDER BY cp.points DESC, verified_count DESC, cp.joinedAt ASC
         LIMIT 100`,
        challengeId
      ) as any[];

      // Formatar ranking
      const ranking = participants.map((p, index) => {
        const position = index + 1;
        let prize = 0;
        if (position === 1) prize = challenge.firstPlacePrizeCents || 0;
        else if (position === 2) prize = challenge.secondPlacePrizeCents || 0;
        else if (position === 3) prize = challenge.thirdPlacePrizeCents || 0;

        return {
          position,
          userId: p.userId,
          userName: p.user_name || "Usuário",
          avatarUrl: p.avatar_url || null,
          points: p.points || 0,
          verifiedCount: Number(p.verified_count) || 0,
          prizeCents: prize,
          isCurrentUser: userId === p.userId,
        };
      });

      // Verificar se o desafio já terminou
      const now = new Date();
      const end = new Date(challenge.endDate);
      if (challenge.endTime && /^\d{2}:\d{2}$/.test(challenge.endTime)) {
        const [h, m] = challenge.endTime.split(':');
        end.setHours(Number(h), Number(m), 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }
      const isFinished = challenge.status === "completed" || challenge.status === "cancelled" || end < now;

      return res.json({
        success: true,
        data: {
          challenge: {
            id: challenge.id,
            title: challenge.title,
            firstPlacePrizeCents: challenge.firstPlacePrizeCents || 0,
            secondPlacePrizeCents: challenge.secondPlacePrizeCents || 0,
            thirdPlacePrizeCents: challenge.thirdPlacePrizeCents || 0,
            isFinished,
            status: challenge.status,
            createdById: challenge.createdById,
          },
          ranking,
        },
      });
    } catch (error: any) {
      console.error("[ChallengeRanking] Erro:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar ranking",
        error: error.message,
      });
    }
  }

  // ================================
  // 🔥 DISTRIBUIR PRÊMIOS (ao final do desafio)
  // ================================
  static async distributePrizes(req: AuthRequest, res: Response) {
    try {
      const { challengeId } = req.params;
      const userId = req.userId;

      if (!challengeId) {
        return res.status(400).json({
          success: false,
          message: "ID do desafio não fornecido",
        });
      }

      // Buscar desafio
      const challenge = await (prisma.challenge as any).findUnique({
        where: { id: challengeId },
      });

      if (!challenge) {
        return res.status(404).json({
          success: false,
          message: "Desafio não encontrado",
        });
      }

      // Verificar se o usuário é o criador do desafio
      if (challenge.status === "cancelled") {
        return res.status(409).json({
          success: false,
          message: "Desafio cancelado nÃ£o pode distribuir prÃªmios",
        });
      }

      if (challenge.createdById !== userId) {
        return res.status(403).json({
          success: false,
          message: "Apenas o criador do desafio pode distribuir prêmios",
        });
      }

      const { distributed } = await PrizeDistributionService.distributeForChallenge(challengeId);

      return res.json({
        success: true,
        message: "Prêmios distribuídos com sucesso. Em caso de empate, o prêmio foi dividido igualmente.",
        data: { distributed },
      });
    } catch (error: any) {
      console.error("[ChallengeRanking] Erro ao distribuir prêmios:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao distribuir prêmios",
        error: error.message,
      });
    }
  }
}

