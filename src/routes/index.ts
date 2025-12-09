import { Router } from "express";

import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";
import walletRoutes from "./wallet.routes";
import paymentsRoutes from "./payments.routes";
import subscribeRoutes from "./subscribe.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/challenges", challengesRoutes);
router.use("/wallet", walletRoutes);
router.use("/payments", paymentsRoutes); // opcional
router.use("/subscribe", subscribeRoutes); // 🔥 IMPORTANTE

export default router;
