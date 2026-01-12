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

// Rotas para solicitações de saque
router.get("/withdrawal-requests", authenticate, WalletController.getWithdrawalRequests);
router.get("/withdrawal-requests/my", authenticate, WalletController.getMyWithdrawalRequests);
router.put("/withdrawal-requests/:id/approve", authenticate, WalletController.approveWithdrawalRequest);
router.put("/withdrawal-requests/:id/reject", authenticate, WalletController.rejectWithdrawalRequest);
router.put("/withdrawal-requests/:id/complete", authenticate, WalletController.completeWithdrawalRequest);

// Rotas para pagamento de depósito via Mercado Pago
router.post("/deposit/payment", authenticate, WalletController.startDepositPayment);
router.post("/deposit/confirm", authenticate, WalletController.confirmDepositPayment);

// Webhook do Mercado Pago (SEM autenticação - chamado pelo Mercado Pago)
// ⚠️ IMPORTANTE: Esta rota deve vir ANTES da rota dinâmica /:userId
router.post("/webhook", WalletController.webhook);
router.get("/webhook", (_req, res) => {
  // Permitir GET apenas para teste (Mercado Pago usa POST)
  res.json({ 
    success: true, 
    message: "Webhook endpoint está ativo. O Mercado Pago enviará requisições POST aqui.",
    method: "Mercado Pago usa POST para webhooks"
  });
});

// NOVA ROTA: carteira de tokens por usuário
// ⚠️ Esta rota dinâmica deve vir DEPOIS das rotas específicas
router.get("/:userId", authenticate, WalletController.getUserTokenWallet);

export default router;

