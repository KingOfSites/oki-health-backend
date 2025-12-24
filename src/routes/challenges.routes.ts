import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/auth";
import { ChallengesController } from "../controllers/challenges.controller";

const challengeRoutes = Router();

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
🔥 5 — ENTRAR NO DESAFIO
============================================================ */
challengeRoutes.post(
  "/:challengeId/join",
  authenticate,
  ChallengesController.joinChallenge
);

/* ============================================================
🔥 6 — CRIAR DESAFIO
============================================================ */
challengeRoutes.post(
  "/",
  authenticate,
  ChallengesController.createChallenge
);

/* ============================================================
🔥 7 — EXCLUIR DESAFIO
============================================================ */
challengeRoutes.delete(
  "/:id",
  authenticate,
  ChallengesController.deleteChallenge
);

export default challengeRoutes;
