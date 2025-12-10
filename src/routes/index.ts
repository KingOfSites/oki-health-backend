import { Router } from "express";

import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";
import walletRoutes from "./wallet.routes";
import challengeChatRoutes from "./challengeChat.routes";
import subscribeRoutes from "./subscribe.routes"; // <-- AQUI

const router = Router();

// ROTAS PRINCIPAIS
router.use("/auth", authRoutes);
router.use("/challenges", challengesRoutes);
router.use("/wallet", walletRoutes);

// 🔥 ROTAS DO CHAT DO DESAFIO
router.use("/challenges", challengeChatRoutes);

// ⭐ ROTAS DE ASSINATURA (PIX + CARTÃO)
router.use("/subscribe", subscribeRoutes);  // <-- AQUI

export default router;
