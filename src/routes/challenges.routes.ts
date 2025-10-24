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

export default router;
