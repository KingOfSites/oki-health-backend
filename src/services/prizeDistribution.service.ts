import prisma from "../config/database";

type DistributionResult = {
  distributed: Array<{
    position: number;
    userId: string;
    userName: string;
    prizeAmount: number;
    tied?: boolean;
    isCreatorFee?: boolean;
  }>;
};

function computeChallengeEnd(challenge: { endDate: Date; endTime?: string | null }) {
  const end = new Date(challenge.endDate);
  if (challenge.endTime && /^\d{2}:\d{2}$/.test(challenge.endTime)) {
    const [h, m] = challenge.endTime.split(":");
    end.setHours(Number(h), Number(m), 59, 999);
  } else {
    end.setHours(23, 59, 59, 999);
  }
  return end;
}

export class PrizeDistributionService {
  static async distributeForChallenge(challengeId: string): Promise<DistributionResult> {
    const challenge = await (prisma.challenge as any).findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      const err: any = new Error("Desafio não encontrado");
      err.code = "CHALLENGE_NOT_FOUND";
      throw err;
    }

    if (challenge.status === "cancelled") {
      const err: any = new Error("Desafio cancelado não pode distribuir prêmios");
      err.code = "CHALLENGE_CANCELLED";
      throw err;
    }

    if (challenge.status === "completed") {
      const err: any = new Error("Os prêmios deste desafio já foram distribuídos");
      err.code = "ALREADY_COMPLETED";
      throw err;
    }

    const now = new Date();
    const end = computeChallengeEnd(challenge);
    if (end > now) {
      const err: any = new Error("O desafio ainda não terminou");
      err.code = "NOT_FINISHED";
      throw err;
    }

    const allParticipants = (await prisma.$queryRawUnsafe(
      `SELECT cp.userId, cp.points, u.name as user_name
       FROM challenge_participants cp
       JOIN users u ON cp.userId = u.id
       WHERE cp.challengeId = ?
       ORDER BY cp.points DESC, cp.joinedAt ASC`,
      challengeId,
    )) as any[];

    if (allParticipants.length === 0) {
      const err: any = new Error("Não há participantes no desafio");
      err.code = "NO_PARTICIPANTS";
      throw err;
    }

    const prizeDistributionType = (challenge as any).prizeDistributionType || "integral";
    const prizesCents = [
      challenge.firstPlacePrizeCents || 0,
      challenge.secondPlacePrizeCents || 0,
      challenge.thirdPlacePrizeCents || 0,
    ];
    const totalPrizeCents = prizesCents[0] + prizesCents[1] + prizesCents[2];

    const distributed: DistributionResult["distributed"] = [];

    await prisma.$transaction(async (tx) => {
      // Idempotência global: se já houve qualquer transação de prêmio, não redistribui.
      const alreadyAny = await tx.transaction.findFirst({
        where: { challengeId, type: { in: ["challenge_prize", "challenge_creator_fee"] } },
        select: { id: true },
      });
      if (alreadyAny) {
        const err: any = new Error("Os prêmios deste desafio já foram distribuídos");
        err.code = "ALREADY_DISTRIBUTED";
        throw err;
      }

      const creditPrizeIfMissing = async (args: {
        userId: string;
        amount: number;
        type: "challenge_prize" | "challenge_creator_fee";
        description: string;
        position: number;
        userName: string;
        tied?: boolean;
        isCreatorFee?: boolean;
      }) => {
        if (args.amount <= 0) return;

        const exists = await tx.transaction.findFirst({
          where: { userId: args.userId, challengeId, type: args.type },
          select: { id: true },
        });
        if (exists) return;

        await tx.user.update({
          where: { id: args.userId },
          data: {
            balance: { increment: args.amount },
            total_earned: { increment: args.amount },
          },
        });

        await tx.transaction.create({
          data: {
            userId: args.userId,
            challengeId,
            type: args.type,
            amount: args.amount,
            status: "completed",
            description: args.description,
          },
        });

        distributed.push({
          position: args.position,
          userId: args.userId,
          userName: args.userName,
          prizeAmount: args.amount,
          tied: args.tied,
          isCreatorFee: args.isCreatorFee,
        });
      };

      if (prizeDistributionType === "dividido" && totalPrizeCents > 0) {
        const shareCents = Math.floor(totalPrizeCents / allParticipants.length);
        const prizeAmount = shareCents / 100;
        for (const member of allParticipants) {
          await creditPrizeIfMissing({
            userId: member.userId,
            userName: member.user_name,
            amount: prizeAmount,
            type: "challenge_prize",
            description: `Saldo Saudável (participação) - ${challenge.title}`,
            position: 0,
            tied: false,
          });
        }
      } else {
        // integral: top 3 com divisão em caso de empate
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
              await creditPrizeIfMissing({
                userId: member.userId,
                userName: member.user_name,
                amount: prizeAmount,
                type: "challenge_prize",
                description:
                  group.length > 1
                    ? `Saldo Saudável ${positionIndex + 1}º lugar (empatados) - ${challenge.title}`
                    : `Saldo Saudável ${positionIndex + 1}º lugar - ${challenge.title}`,
                position: positionIndex + 1,
                tied: group.length > 1,
              });
            }
          }

          i += group.length;
          positionIndex++;
        }
      }

      // PDF (Maio/2026 #9): 5% para o criador Premium ao final do desafio
      // concluído. O campo `isPro` permanece no schema mas representa o
      // plano Premium da nova estrutura (Free / Premium / Afiliado).
      if (totalPrizeCents > 0) {
        const creator = await tx.user.findUnique({
          where: { id: challenge.createdById },
          select: { isPro: true },
        });
        if ((creator as any)?.isPro) {
          const creatorShareCents = Math.floor(totalPrizeCents * 0.05);
          const creatorAmount = creatorShareCents / 100;
          await creditPrizeIfMissing({
            userId: challenge.createdById,
            userName: "Criador (Premium)",
            amount: creatorAmount,
            type: "challenge_creator_fee",
            description: `5% retorno Premium - ${challenge.title}`,
            position: 0,
            isCreatorFee: true,
          });
        }
      }

      await (tx.challenge as any).update({
        where: { id: challengeId },
        data: { status: "completed" },
      });
    });

    return { distributed };
  }
}

