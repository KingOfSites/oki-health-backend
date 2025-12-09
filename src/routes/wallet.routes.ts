import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { WalletController } from "../controllers/wallet.controller";

const router = Router();

// rota existente:
router.get("/", authenticate, WalletController.getWallet);

// NOVA ROTA: carteira de tokens por usuário
router.get("/:userId", authenticate, WalletController.getUserTokenWallet);

export default router;

