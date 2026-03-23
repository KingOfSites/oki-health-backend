import { Router } from "express";
import { SubscribeController } from "../controllers/subscribe.controller"; 
import { authenticate } from "../middleware/auth";  // ← CORRETO!

const router = Router();

// ------------------------------------------------------
// 💳 PAGAMENTO COM CARTÃO
// ------------------------------------------------------
router.post("/card", authenticate, SubscribeController.subscribeWithCard);

// ------------------------------------------------------
// 💸 PAGAMENTO COM PIX
// ------------------------------------------------------
router.post("/pix", authenticate, SubscribeController.subscribeWithPix);

// ------------------------------------------------------
// 🟢 GOOGLE PAY
// ------------------------------------------------------
router.post("/google-pay", authenticate, SubscribeController.subscribeWithGooglePay);

// ------------------------------------------------------
// 🍎 APPLE PAY
// ------------------------------------------------------
router.post("/apple-pay", authenticate, SubscribeController.subscribeWithApplePay);

// ------------------------------------------------------
// ⭐ STATUS PREMIUM DO USUÁRIO
// (para o app saber se ele é premium ou não)
// ------------------------------------------------------
router.get("/status/:userId", authenticate, SubscribeController.getStatus);

export default router;
