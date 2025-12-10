import { Router } from "express";

import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";
import walletRoutes from "./wallet.routes";
import challengeChatRoutes from "./challengeChat.routes";
import rankingRoutes from "./ranking.routes";   // ✅ ADICIONAR ISSO
import gamificationRoutes from "./gamification.routes"; // se tiver

const router = Router();

// ROTAS PRINCIPAIS
router.use("/auth", authRoutes);
router.use("/challenges", challengesRoutes);
router.use("/wallet", walletRoutes);

// 🔥 Ranking
router.use("/ranking", rankingRoutes); // agora funciona

// 🔥 Gamificação, se estiver usando
router.use("/gamification", gamificationRoutes);

// 🔥 Chat do desafio
router.use("/challenges", challengeChatRoutes);

export default router;
