import { Router } from "express";
import { SubscribeController } from "../controllers/subscribe.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// 🔥 LISTAR PLANOS (público — qualquer usuário pode ver os planos disponíveis)
router.get("/plans", SubscribeController.listPlans);

// 🔥 ROTAS PROTEGIDAS — agora com authenticate!
router.post("/card", authenticate, SubscribeController.subscribeWithCard);
router.post("/pix", authenticate, SubscribeController.subscribeWithPix);
router.post("/google-pay", authenticate, SubscribeController.subscribeWithGooglePay);
router.post("/apple-pay", authenticate, SubscribeController.subscribeWithApplePay);

// 🔥 VERIFICAR STATUS DO PAGAMENTO PIX
router.get("/pix/:paymentId", authenticate, SubscribeController.checkPixPayment);

// 🔥 ROTA DE STATUS (com auth - pega userId do token)
router.get("/status", authenticate, SubscribeController.getMyStatus);

// 🔥 ROTA DE STATUS POR USER ID (não precisa auth - para compatibilidade)
router.get("/status/:userId", SubscribeController.getStatus);

export default router;
