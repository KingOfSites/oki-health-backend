import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { WalletController } from "../controllers/wallet.controller";

const router = Router();

// GET SALDO
router.get("/", authenticate, WalletController.getWallet);

// sacar futuramente
// router.post("/withdraw", authenticate, WalletController.withdraw);

export default router;
