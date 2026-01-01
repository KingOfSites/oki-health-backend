import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { AdminController } from "../controllers/admin.controller";
import { WalletController } from "../controllers/wallet.controller";

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// Dashboard
router.get("/dashboard", AdminController.getDashboard);

// Usuários
router.get("/users", AdminController.getUsers);

// Solicitações de saque
router.get("/withdrawal-requests", AdminController.getWithdrawalRequests);

// Ações nas solicitações (já existem no WalletController)
router.put("/withdrawal-requests/:id/approve", WalletController.approveWithdrawalRequest);
router.put("/withdrawal-requests/:id/reject", WalletController.rejectWithdrawalRequest);
router.put("/withdrawal-requests/:id/complete", WalletController.completeWithdrawalRequest);

export default router;

