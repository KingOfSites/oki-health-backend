import { Router } from "express";
import { updateUserProfile } from "../controllers/user.controller";
import { authenticate } from "../middleware/auth"; // você já usa isso nas outras rotas

const router = Router();

router.put("/profile", authenticate, updateUserProfile);

export default router;
