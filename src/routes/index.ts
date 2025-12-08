import { Router } from "express";
import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";
import subscribeRoutes from "./subscribe.routes";
import userRoutes from "./user.routes"; // <-- IMPORTANTE

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Oki Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/challenges", challengesRoutes);
router.use("/subscribe", subscribeRoutes);
router.use("/user", userRoutes); // <-- REGISTRAR AQUI

export default router;
