import { Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";

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
      const isFinished = challenge.status === "completed" || end < now;

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
      if (challenge.createdById !== userId) {
        return res.status(403).json({
          success: false,
          message: "Apenas o criador do desafio pode distribuir prêmios",
        });
      }

      // Verificar se o desafio já terminou
      const now = new Date();
      const end = new Date(challenge.endDate);
      if (challenge.endTime && /^\d{2}:\d{2}$/.test(challenge.endTime)) {
        const [h, m] = challenge.endTime.split(':');
        end.setHours(Number(h), Number(m), 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }

      if (end > now && challenge.status !== "completed") {
        return res.status(400).json({
          success: false,
          message: "O desafio ainda não terminou",
        });
      }

      // Verificar se já foi finalizado
      if (challenge.status === "completed") {
        return res.status(400).json({
          success: false,
          message: "Os prêmios deste desafio já foram distribuídos",
        });
      }

      const allParticipants = await prisma.$queryRawUnsafe(
        `SELECT cp.userId, cp.points, u.name as user_name
         FROM challenge_participants cp
         JOIN users u ON cp.userId = u.id
         WHERE cp.challengeId = ?
         ORDER BY cp.points DESC, cp.joinedAt ASC`,
        challengeId
      ) as any[];

      if (allParticipants.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Não há participantes no desafio",
        });
      }

      const prizeDistributionType = (challenge as any).prizeDistributionType || "integral";
      const prizesCents = [
        challenge.firstPlacePrizeCents || 0,
        challenge.secondPlacePrizeCents || 0,
        challenge.thirdPlacePrizeCents || 0,
      ];
      const totalPrizeCents = prizesCents[0] + prizesCents[1] + prizesCents[2];
      const distributed: any[] = [];
      const winnerIds = new Set<string>();

      if (prizeDistributionType === "dividido" && totalPrizeCents > 0) {
        // Modo dividido: prêmio total repartido igualmente entre todos os participantes
        const shareCents = Math.floor(totalPrizeCents / allParticipants.length);
        const prizeAmount = shareCents / 100;
        for (const member of allParticipants) {
          await prisma.user.update({
            where: { id: member.userId },
            data: {
              balance: { increment: prizeAmount },
              total_earned: { increment: prizeAmount },
            },
          });
          await prisma.transaction.create({
            data: {
              userId: member.userId,
              challengeId,
              type: "challenge_prize",
              amount: prizeAmount,
              status: "completed",
              description: `Saldo Saudável (participação) - ${challenge.title}`,
            },
          });
          distributed.push({
            position: 0,
            userId: member.userId,
            userName: member.user_name,
            prizeAmount,
            tied: false,
          });
          winnerIds.add(member.userId);
        }
      } else {
        // Modo integral: top 3 recebem os prêmios definidos
        let positionIndex = 0;
        let i = 0;
        while (i < allParticipants.length && positionIndex < 3) {
          const currentPoints = allParticipants[i].points ?? 0;
          const group = allParticipants.filter((p) => (p.points ?? 0) === currentPoints);
          const prizeCents = prizesCents[positionIndex];
          if (prizeCents > 0 && group.length > 0) {
            const shareCents = Math.floor(prizeCents / group.length);
            const prizeAmount = shareCents / 100;
            for (const member of group) {
              await prisma.user.update({
                where: { id: member.userId },
                data: {
                  balance: { increment: prizeAmount },
                  total_earned: { increment: prizeAmount },
                },
              });
              await prisma.transaction.create({
                data: {
                  userId: member.userId,
                  challengeId,
                  type: "challenge_prize",
                  amount: prizeAmount,
                  status: "completed",
                  description: group.length > 1
                    ? `Saldo Saudável ${positionIndex + 1}º lugar (empatados) - ${challenge.title}`
                    : `Saldo Saudável ${positionIndex + 1}º lugar - ${challenge.title}`,
                },
              });
              distributed.push({
                position: positionIndex + 1,
                userId: member.userId,
                userName: member.user_name,
                prizeAmount,
                tied: group.length > 1,
              });
              winnerIds.add(member.userId);
            }
          }
          i += group.length;
          positionIndex++;
        }
      }
      const creatorIsParticipant = winnerIds.has(challenge.createdById) || allParticipants.some((p: any) => p.userId === challenge.createdById);
      if (totalPrizeCents > 0) {
        const creator = await prisma.user.findUnique({
          where: { id: challenge.createdById },
          select: { isPro: true },
        });
        if (creator?.isPro) {
          const creatorShareCents = Math.floor(totalPrizeCents * 0.05);
          const creatorAmount = creatorShareCents / 100;
          await prisma.user.update({
            where: { id: challenge.createdById },
            data: {
              balance: { increment: creatorAmount },
              total_earned: { increment: creatorAmount },
            },
          });
          await prisma.transaction.create({
            data: {
              userId: challenge.createdById,
              challengeId,
              type: "challenge_creator_fee",
              amount: creatorAmount,
              status: "completed",
              description: `5% criador PRO - ${challenge.title}`,
            },
          });
          distributed.push({
            position: 0,
            userId: challenge.createdById,
            userName: "Criador (PRO)",
            prizeAmount: creatorAmount,
            isCreatorFee: true,
          });
        }
      }

      // Atualizar o status do desafio para completed para não distribuir de novo
      await (prisma.challenge as any).update({
        where: { id: challengeId },
        data: { status: "completed" }
      });

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

