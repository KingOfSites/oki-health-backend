import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { ChallengePaymentController } from "../controllers/challengePayment.controller";

const router = Router();

// INICIAR PAGAMENTO
router.post(
  "/start/:challengeId",
  authenticate,
  (req, res) => ChallengePaymentController.start(req, res)
);

// CONFIRMAR PAGAMENTO PIX
router.post(
  "/confirm",
  authenticate,
  (req, res) => ChallengePaymentController.confirm(req, res)
);

export default router;
