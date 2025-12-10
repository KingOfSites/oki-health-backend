import { Router } from "express";

import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";
import walletRoutes from "./wallet.routes";
import challengeChatRoutes from "./challengeChat.routes";
import gamificationRoutes from "./gamification.routes";
import rankingRoutes from "./ranking.routes";


const router = Router();

// ROTAS PRINCIPAIS
router.use("/ranking", rankingRoutes);
router.use("/auth", authRoutes);
router.use("/challenges", challengesRoutes);
router.use("/wallet", walletRoutes);

// 🔥 ROTAS DO CHAT DO DESAFIO
router.use("/challenges", challengeChatRoutes);

// 🔥 ROTAS DE GAMIFICAÇÃO — AGORA EXISTE!
router.use("/gamification", gamificationRoutes);

export default router;
