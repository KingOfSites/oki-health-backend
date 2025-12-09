import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { ChallengesController } from "../controllers/challenges.controller";

const challengeRoutes = Router();

challengeRoutes.get("/my", authenticate, ChallengesController.listMyChallenges);

// ✔ Desafios criados pelo usuário
challengeRoutes.get("/created", authenticate, ChallengesController.listCreatedChallenges);

// ✔ Criar desafio
challengeRoutes.post("/", authenticate, ChallengesController.createChallenge);

// ✔ Buscar desafios por localização
challengeRoutes.get("/search", ChallengesController.searchChallenges);

// ✔ Participar do desafio
challengeRoutes.post("/:challengeId/join", authenticate, ChallengesController.joinChallenge);

// ✔ Detalhes do desafio
challengeRoutes.get("/:id/details", authenticate, ChallengesController.getDetails);

challengeRoutes.delete("/:id", authenticate, ChallengesController.deleteChallenge);

export default challengeRoutes;
