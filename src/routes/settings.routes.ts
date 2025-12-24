import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Todas as rotas requerem autenticação
router.get("/", authenticate, SettingsController.getSettings);
router.put("/", authenticate, SettingsController.updateSettings);
router.put("/password", authenticate, SettingsController.updatePassword);

export default router;

