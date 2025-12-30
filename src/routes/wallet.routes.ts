import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { WalletController } from "../controllers/wallet.controller";

const router = Router();

// rota existente:
router.get("/", authenticate, WalletController.getWallet);

// Rota para transações do usuário logado
router.get("/transactions", authenticate, WalletController.getTransactions);

// Rotas para depósito e saque
router.post("/deposit", authenticate, WalletController.deposit);
router.post("/withdraw", authenticate, WalletController.withdraw);

// Rotas para pagamento de depósito via Mercado Pago
router.post("/deposit/payment", authenticate, WalletController.startDepositPayment);
router.post("/deposit/confirm", authenticate, WalletController.confirmDepositPayment);

// NOVA ROTA: carteira de tokens por usuário
router.get("/:userId", authenticate, WalletController.getUserTokenWallet);

export default router;

