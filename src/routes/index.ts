import { Router } from "express";
import authRoutes from "./auth.routes";
import challengesRoutes from "./challenges.routes";

const router = Router();

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Oki Backend API is running",
    timestamp: new Date().toISOString(),
  });
});

// API routes
router.use("/auth", authRoutes);
router.use("/challenges", challengesRoutes);

export default router;
