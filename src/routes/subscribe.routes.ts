import { Router } from "express";
import { SubscribeController } from "../controllers/subscribe.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// 🔥 ROTAS PROTEGIDAS — agora com authenticate!
router.post("/card", authenticate, SubscribeController.subscribeWithCard);
router.post("/pix", authenticate, SubscribeController.subscribeWithPix);

// 🔥 ROTA DE STATUS (não precisa auth)
router.get("/status/:userId", SubscribeController.getStatus);

export default router;
