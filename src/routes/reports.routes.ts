import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { ReportsController } from "../controllers/reports.controller";

const router = Router();

router.post("/", authenticate, ReportsController.createReport);

export default router;
