import { Router } from "express";

import authRoutes from "./auth.routes";
import notificationsRoutes from "./notifications.routes";
import challengesRoutes from "./challenges.routes";
import walletRoutes from "./wallet.routes";
// import challengeChatRoutes from "./challengeChat.routes";
import challengePostsRoutes from "./challengePosts.routes";
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

// 🔥 Notificações (stub: lista vazia, marcar como lidas)
router.use("/notifications", notificationsRoutes);

// 🔥 Desafios (CRUD + participar + buscar + chat)
router.use("/challenges", challengesRoutes);

// 🔥 Upload de imagens do chat (Firebase Storage)
router.use("/challenge-posts", challengePostsRoutes);

// 🔥 Pagamento de desafios (PIX / Cartão)
import challengePaymentRoutes from "./challengePayment.routes";
router.use("/challenge-payments", challengePaymentRoutes);

// 🔥 Carteira do usuário
router.use("/wallet", walletRoutes);

// 🔥 Ranking global
router.use("/ranking", rankingRoutes);

// 🔥 Gamificação (nível, XP)
router.use("/gamification", gamificationRoutes);

// 🔥 Nutrição (análise sem IA)
router.use("/nutrition", nutritionRoutes);

// 🔥 Evolução de peso
import weightsRoutes from "./weights.routes";
router.use("/weights", weightsRoutes);

export default router;
