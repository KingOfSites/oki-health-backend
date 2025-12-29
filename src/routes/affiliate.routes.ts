import { Router } from "express";
import { AffiliateController } from "../controllers/affiliate.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Todas as rotas requerem autenticação
router.get("/stats", authenticate, AffiliateController.getStats);
router.get("/stats/detailed", authenticate, AffiliateController.getDetailedStats);
router.get("/link", authenticate, AffiliateController.getLink);
router.get("/referrals", authenticate, AffiliateController.getReferrals);
router.get("/payments", authenticate, AffiliateController.getPaymentHistory);
router.post("/register", authenticate, AffiliateController.registerCode);

export default router;

