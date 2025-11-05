import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { ChallengesController } from "../controllers/challenges.controller";

const router = Router();

// List challenges the user participates in
router.get("/my", authenticate, ChallengesController.listMyChallenges);

// List challenges created by the user
router.get(
  "/created",
  authenticate,
  ChallengesController.listCreatedChallenges
);

// Create a new challenge
router.post("/", authenticate, ChallengesController.createChallenge);

// List all public challenges (no auth required)
router.get("/all", ChallengesController.listAllChallenges);

export default router;
