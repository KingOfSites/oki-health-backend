import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { GamificationController } from "../controllers/gamification.controller";

const router = Router();

router.get("/me", authenticate, GamificationController.getUserGamification);

export default router;
