import { Router } from "express";
import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";
import walletRoutes from "./wallet.routes";

const router = Router(); // <- TEM QUE VIR AQUI EM CIMA

router.use("/auth", authRoutes);
router.use("/challenges", challengesRoutes);
router.use("/wallet", walletRoutes);

export default router;
