import { Router } from "express";
import { SubscribeController } from "../controllers/subscribe.controller"; 
import { authMiddleware } from "../middleware/auth"; // ← CORRETO

const router = Router();

// 💳 PAGAMENTO COM CARTÃO
router.post("/card", authMiddleware, SubscribeController.subscribeWithCard);

// 💸 PAGAMENTO COM PIX
router.post("/pix", authMiddleware, SubscribeController.subscribeWithPix);

// ⭐ STATUS PREMIUM (para o app saber se o usuário é premium)
router.get("/status/:userId", authMiddleware, SubscribeController.getStatus);

export default router;
