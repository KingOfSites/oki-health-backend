import { Router } from "express";
import { PaymentsController } from "../controllers/payments.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/card", authenticate, PaymentsController.payWithCard);

export default router;
