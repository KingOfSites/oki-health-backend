import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import { ChallengesController } from "../controllers/challenges.controller";
import { ChallengeChatController } from "../controllers/challengeChat.controller";
import { ChallengeRankingController } from "../controllers/challengeRanking.controller";
import { PrivateChatController } from "../controllers/privateChat.controller";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";

const challengeRoutes = Router();

/* ============================================================
🔥 OKI 24/05/2026 #15 — REGISTRAR COMPARTILHAMENTO SOCIAL (+2 PTS)
Limite de 1 compartilhamento contabilizado por dia/desafio.
============================================================ */
challengeRoutes.post(
  "/:challengeId/share-bonus",
  authenticate,
  async (req: any, res) => {
    try {
      const userId: string | undefined = (req as AuthRequest).userId;
      const { challengeId } = req.params;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
      if (!challengeId) return res.status(400).json({ success: false, message: "Desafio inválido" });

      const participant = await prisma.challengeParticipant.findUnique({
        where: { userId_challengeId: { userId, challengeId } },
        select: { id: true },
      });
      if (!participant) {
        return res
          .status(403)
          .json({ success: false, message: "Apenas participantes podem ganhar bônus." });
      }

      const alreadyToday = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM transactions
          WHERE userId = ? AND challengeId = ?
            AND type = 'social_share_bonus'
            AND DATE(created_at) = CURDATE()
          LIMIT 1`,
        userId,
        challengeId,
      );

      if (alreadyToday.length > 0) {
        return res.json({
          success: true,
          awarded: false,
          message: "Você já recebeu pontos por compartilhar este desafio hoje.",
        });
      }

      await prisma.$executeRawUnsafe(
        `UPDATE challenge_participants
            SET points = points + 2
          WHERE userId = ? AND challengeId = ?`,
        userId,
        challengeId,
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO transactions (id, userId, challengeId, type, amount, status, description, created_at)
         VALUES (UUID(), ?, ?, 'social_share_bonus', 0, 'completed',
                 'Bônus de 2 pts por compartilhamento social', NOW())`,
        userId,
        challengeId,
      );

      return res.json({ success: true, awarded: true, points: 2 });
    } catch (err: any) {
      console.error("[challenges/share-bonus]", err);
      return res.status(500).json({ success: false, message: "Erro interno" });
    }
  },
);

/* ============================================================
🔥 0 — CHAT DO DESAFIO (deve vir antes de /:id/details)
============================================================ */
challengeRoutes.get(
  "/:challengeId/chat",
  authenticate,
  ChallengeChatController.getMessages
);
challengeRoutes.post(
  "/:challengeId/chat",
  authenticate,
  ChallengeChatController.sendMessage
);
challengeRoutes.get(
  "/:challengeId/chat/rejections/pending",
  authenticate,
  ChallengeChatController.getPendingRejections,
);
challengeRoutes.post(
  "/chat/rejections/:messageId/ack",
  authenticate,
  ChallengeChatController.acknowledgeRejection,
);

/* ============================================================
🔥 0.1 — CHAT PRIVADO 1:1 (entre participantes)
============================================================ */
challengeRoutes.get(
  "/:challengeId/private-conversations",
  authenticate,
  PrivateChatController.listConversations,
);
challengeRoutes.post(
  "/:challengeId/private-conversations",
  authenticate,
  PrivateChatController.getOrCreateConversation,
);
challengeRoutes.get(
  "/private-conversations/:conversationId/messages",
  authenticate,
  PrivateChatController.getMessages,
);
challengeRoutes.post(
  "/private-conversations/:conversationId/messages",
  authenticate,
  PrivateChatController.sendMessage,
);

/* ============================================================
🔥 1 — DETALHES DO DESAFIO
============================================================ */
challengeRoutes.get(
  "/:id/details",
  authenticate,
  ChallengesController.getDetails
);

/* ============================================================
🔥 2 — MEUS DESAFIOS
============================================================ */
challengeRoutes.get(
  "/my",
  authenticate,
  ChallengesController.listMyChallenges
);

/* ============================================================
🔥 3 — DESAFIOS CRIADOS POR MIM
============================================================ */
challengeRoutes.get(
  "/created",
  authenticate,
  ChallengesController.listCreatedChallenges
);

// ✔ Buscar desafios por localização (autenticação opcional para mostrar se está participando)
challengeRoutes.get("/search", optionalAuthenticate, ChallengesController.searchChallenges);

/* ============================================================
🔥 META DE PERDA DE PESO (Modo Balança)
============================================================ */
challengeRoutes.get(
  "/weight-goal",
  authenticate,
  ChallengesController.getWeightGoal
);

/* ============================================================
🔥 5 — ENTRAR NO DESAFIO
============================================================ */
challengeRoutes.post(
  "/:challengeId/join",
  authenticate,
  ChallengesController.joinChallenge
);

challengeRoutes.post(
  "/:id/cancel",
  authenticate,
  ChallengesController.cancelChallenge
);

/* ============================================================
🔥 6 — CRIAR DESAFIO
============================================================ */
challengeRoutes.post(
  "/",
  authenticate,
  ChallengesController.createChallenge
);

challengeRoutes.put(
  "/:id",
  authenticate,
  ChallengesController.updateChallenge
);

challengeRoutes.patch(
  "/:id",
  authenticate,
  ChallengesController.updateChallenge
);

/* ============================================================
🔥 7 — EXCLUIR DESAFIO
============================================================ */
challengeRoutes.delete(
  "/:id",
  authenticate,
  ChallengesController.deleteChallenge
);

/* ============================================================
🔥 8 — RANKING DO DESAFIO
============================================================ */
challengeRoutes.get(
  "/:challengeId/ranking",
  authenticate,
  ChallengeRankingController.getRanking
);

/* ============================================================
🔥 9 — DISTRIBUIR PRÊMIOS (apenas criador)
============================================================ */
challengeRoutes.post(
  "/:challengeId/distribute-prizes",
  authenticate,
  ChallengeRankingController.distributePrizes
);

export default challengeRoutes;
