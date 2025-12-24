import { Router } from "express";

import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";
import walletRoutes from "./wallet.routes";
import challengeChatRoutes from "./challengeChat.routes";
import rankingRoutes from "./ranking.routes";
import gamificationRoutes from "./gamification.routes";
import nutritionRoutes from "./nutrition.routes";
import aiRoutes from "./ai.routes"; // IA

// ⚠️ MOVER O ROUTER PARA CIMA
const router = Router();

// ===============================
// 📌 Rotas principais
// ===============================

// 🔥 IA (NOVO)
router.use("/ai", aiRoutes);

// 🔥 Autenticação
router.use("/auth", authRoutes);

// 🔥 Desafios (CRUD + participar + buscar)
router.use("/challenges", challengesRoutes);

// 🔥 Pagamento de desafios (PIX / Cartão)
import challengePaymentRoutes from "./challengePayment.routes";
router.use("/challenge-payments", challengePaymentRoutes);

// 🔥 Chat do desafio
router.use("/challenge-chat", challengeChatRoutes);

// 🔥 Carteira do usuário
router.use("/wallet", walletRoutes);

// 🔥 Ranking global
router.use("/ranking", rankingRoutes);

// 🔥 Gamificação (nível, XP)
router.use("/gamification", gamificationRoutes);

// 🔥 Nutrição (análise sem IA)
router.use("/nutrition", nutritionRoutes);

export default router;
