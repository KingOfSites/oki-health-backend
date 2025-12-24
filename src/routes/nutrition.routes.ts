import { Router } from "express";
import { NutritionController } from "../controllers/nutrition.controller";

const router = Router();

router.post("/ask", NutritionController.ask);

export default router;
