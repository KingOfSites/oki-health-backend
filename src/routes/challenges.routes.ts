import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import { ChallengesController } from "../controllers/challenges.controller";
import { ChallengeChatController } from "../controllers/challengeChat.controller";
import { ChallengeRankingController } from "../controllers/challengeRanking.controller";
import { PrivateChatController } from "../controllers/privateChat.controller";

const challengeRoutes = Router();

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
