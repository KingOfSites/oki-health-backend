import { Request, Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { MercadoPagoConfig, Payment, CardToken } from "mercadopago";
import crypto from "crypto";

// ======================================================
// 🔑 CONFIG MERCADO PAGO - APENAS PRODUÇÃO
// ======================================================
const mpAccessToken =
  process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;

// Verificar se o Access Token está configurado
if (!mpAccessToken) {
  console.error("❌ [Mercado Pago] ERRO CRÍTICO: MP_ACCESS_TOKEN não configurado!");
  console.error("   Configure a variável MP_ACCESS_TOKEN no arquivo .env");
  console.error("   Use APENAS token de PRODUÇÃO (começa com APP_USR-)");
  process.exit(1); // Encerra o servidor se não tiver token
} else {
  const tokenPrefix = mpAccessToken.substring(0, 7); // "APP_USR" ou "TEST-"
  const isTestMode = mpAccessToken.startsWith("TEST-");
  const isProductionMode = mpAccessToken.startsWith("APP_USR-");
  
  // BLOQUEAR MODO DE TESTE - APENAS PRODUÇÃO PERMITIDA
  if (isTestMode) {
    console.error("❌ [Mercado Pago] ERRO: Token de TESTE detectado!");
    console.error("   ⚠️  APENAS tokens de PRODUÇÃO são permitidos neste sistema!");
    console.error("   Token detectado: TEST-...");
    console.error("   Configure MP_ACCESS_TOKEN com token de PRODUÇÃO (começa com APP_USR-)");
    console.error("   Exemplo: APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536");
    process.exit(1); // Encerra o servidor se tentar usar token de teste
  } else if (isProductionMode) {
    console.log(`✅ [Mercado Pago] Configurado - Modo: PRODUÇÃO`);
    console.log(`   Token: ${tokenPrefix}...${mpAccessToken.slice(-4)}`);
    console.log(`   ⚠️  ATENÇÃO: Você está em modo PRODUÇÃO - transações serão REAIS!`);
    console.log(`   💰 Pagamentos serão processados com dinheiro REAL!`);
  } else {
    console.error(`❌ [Mercado Pago] Token com formato inválido: ${tokenPrefix}...`);
    console.error(`   ⚠️  APENAS tokens de PRODUÇÃO são permitidos (devem começar com APP_USR-)`);
    console.error(`   Token fornecido não é válido para produção`);
    process.exit(1); // Encerra o servidor se o token for inválido
  }
  
  // Verificar se o Webhook Secret está configurado
  const webhookSecret = process.env.MP_WEBHOOK_SECRET || process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (webhookSecret) {
    console.log(`✅ [Mercado Pago] Webhook Secret configurado`);
  } else {
    console.warn(`⚠️  [Mercado Pago] MP_WEBHOOK_SECRET não configurado - webhooks sem validação de assinatura`);
  }
}

const mp = new MercadoPagoConfig({
  accessToken: mpAccessToken || "",
});

export class WalletController {

  // GET /api/wallet
  static async getWallet(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          balance: true,
          total_earned: true,
          total_withdrawn: true,
          xp: true,
          level: true,
        },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      // Retornar valores diretamente como Float (reais) conforme o schema
      return res.json({
        balance: user.balance ?? 0,
        total_earned: user.total_earned ?? 0,
        total_withdrawn: user.total_withdrawn ?? 0,
        xp: user.xp ?? 0,
        level: user.level ?? 1,
      });

    } catch (err) {
      console.error("[Wallet.getWallet]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // GET /api/wallet/:userId
  static async getUserTokenWallet(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const rows = await prisma.transaction.findMany({
        where: { userId }, // ✔ CORRETO
        orderBy: { created_at: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          type: true,
          created_at: true,
        },
      });

      return res.json(rows);

    } catch (err) {
      console.error("[Wallet.getUserTokenWallet]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST /api/wallet/deposit
  static async deposit(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount,
          type: "deposit",
          status: "completed",
          description: `Depósito de R$ ${amount.toFixed(2)}`,
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount },
          total_earned: { increment: amount },
        },
      });

      return res.json({ success: true, id: transaction.id });

    } catch (err) {
      console.error("[Wallet.deposit]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // GET /api/wallet/transactions
  static async getTransactions(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Buscar transações normais
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { created_at: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          status: true,
          created_at: true,
        },
      });

      // Buscar solicitações de saque rejeitadas para incluir no histórico
      const rejectedWithdrawals = await prisma.withdrawalRequest.findMany({
        where: { 
          userId,
          status: "rejected"
        },
        orderBy: { created_at: "desc" },
        take: 50,
        select: {
          id: true,
          amount: true,
          adminNotes: true,
          created_at: true,
        },
      });

      // Converter saques rejeitados para formato de transação
      const rejectedTransactions = rejectedWithdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        type: "withdraw_rejected",
        amount: withdrawal.amount,
        description: withdrawal.adminNotes 
          ? `Saque rejeitado: ${withdrawal.adminNotes}` 
          : "Saque rejeitado",
        status: "rejected",
        created_at: withdrawal.created_at,
      }));

      // Combinar e ordenar todas as transações por data (mais recente primeiro)
      const allTransactions = [...transactions, ...rejectedTransactions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Retornar apenas as 50 mais recentes
      return res.json(allTransactions.slice(0, 50));

    } catch (err) {
      console.error("[Wallet.getTransactions]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST /api/wallet/withdraw (CRIAR SOLICITAÇÃO DE SAQUE)
  static async withdraw(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const {
        amount,
        withdrawalType, // "bank" ou "pix"
        fullName,
        cpf,
        // Dados bancários
        bankName,
        agency,
        account,
        accountType,
        // Dados PIX
        pixKeyType, // "cpf", "email", "phone", "random"
        pixKey,
      } = req.body;

      // Validações básicas
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      if (amount < 1) {
        return res.status(400).json({ error: "O valor mínimo para saque é R$ 1,00" });
      }

      if (!fullName || !cpf) {
        return res.status(400).json({ error: "Nome completo e CPF são obrigatórios" });
      }

      const cpfDigits = String(cpf).replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return res.status(400).json({ error: "CPF inválido" });
      }

      // Validações específicas por tipo
      if (withdrawalType === "bank") {
        if (!bankName || !agency || !account || !accountType) {
          return res.status(400).json({ error: "Todos os dados bancários são obrigatórios" });
        }
      } else if (withdrawalType === "pix") {
        if (!bankName) {
          return res.status(400).json({ error: "Nome do banco é obrigatório para saque PIX" });
        }
        if (!pixKeyType || !pixKey) {
          return res.status(400).json({ error: "Tipo e chave PIX são obrigatórios" });
        }

        // Validar tipo de chave PIX
        const validPixKeyTypes = ["cpf", "email", "phone", "random"];
        if (!validPixKeyTypes.includes(pixKeyType)) {
          return res.status(400).json({ error: "Tipo de chave PIX inválido" });
        }

        // Validações específicas por tipo de chave
        if (pixKeyType === "cpf") {
          const pixCpfDigits = String(pixKey).replace(/\D/g, "");
          if (pixCpfDigits.length !== 11) {
            return res.status(400).json({ error: "CPF da chave PIX inválido" });
          }
        } else if (pixKeyType === "email") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(pixKey)) {
            return res.status(400).json({ error: "Email da chave PIX inválido" });
          }
        } else if (pixKeyType === "phone") {
          const phoneDigits = String(pixKey).replace(/\D/g, "");
          if (phoneDigits.length < 10 || phoneDigits.length > 11) {
            return res.status(400).json({ error: "Telefone da chave PIX inválido" });
          }
        } else if (pixKeyType === "random") {
          // Chave aleatória (UUID) - validar formato básico
          if (pixKey.length < 32) {
            return res.status(400).json({ error: "Chave PIX aleatória inválida" });
          }
        }
      } else {
        return res.status(400).json({ error: "Tipo de saque inválido. Use 'bank' ou 'pix'" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.balance < amount) {
        return res.status(400).json({ error: "Saldo insuficiente" });
      }

      // Criar solicitação de saque
      const withdrawalRequest = await prisma.withdrawalRequest.create({
        data: {
          userId,
          amount,
          withdrawalType: withdrawalType || "bank",
          fullName: fullName.trim(),
          cpf: cpfDigits,
          // Dados bancários
          // Para PIX: salvar bankName também para confirmação do admin
          // Para Bank: salvar todos os dados bancários
          bankName: bankName?.trim() || null,
          agency: withdrawalType === "bank" ? agency.trim() : null,
          account: withdrawalType === "bank" ? account.trim() : null,
          accountType: withdrawalType === "bank" ? accountType : null,
          // Dados PIX (se tipo = pix)
          pixKeyType: withdrawalType === "pix" ? pixKeyType : null,
          pixKey: withdrawalType === "pix" ? pixKey.trim() : null,
          status: "pending",
        },
      });

      return res.json({
        success: true,
        message: "Solicitação de saque criada com sucesso",
        data: {
          id: withdrawalRequest.id,
          amount: withdrawalRequest.amount,
          status: withdrawalRequest.status,
          withdrawalType: withdrawalRequest.withdrawalType,
        },
      });

    } catch (err) {
      console.error("[Wallet.withdraw]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // GET /api/wallet/withdrawal-requests (LISTAR SOLICITAÇÕES - ADMIN)
  static async getWithdrawalRequests(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verificar se é admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!user || !user.isAdmin) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }

      const { status } = req.query;

      const where: any = {};
      if (status) {
        where.status = status;
      }

      const requests = await prisma.withdrawalRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              balance: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
      });

      return res.json({
        success: true,
        data: requests,
      });

    } catch (err) {
      console.error("[Wallet.getWithdrawalRequests]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // GET /api/wallet/withdrawal-requests/my (MINHAS SOLICITAÇÕES)
  static async getMyWithdrawalRequests(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const requests = await prisma.withdrawalRequest.findMany({
        where: { userId },
        orderBy: {
          created_at: "desc",
        },
      });

      return res.json({
        success: true,
        data: requests,
      });

    } catch (err) {
      console.error("[Wallet.getMyWithdrawalRequests]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // PUT /api/wallet/withdrawal-requests/:id/approve (APROVAR SOLICITAÇÃO - ADMIN)
  static async approveWithdrawalRequest(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verificar se é admin
      const admin = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!admin || !admin.isAdmin) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }

      const { id } = req.params;
      const { adminNotes } = req.body;

      const request = await prisma.withdrawalRequest.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              balance: true,
            },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Solicitação já foi processada" });
      }

      if (request.user.balance < request.amount) {
        return res.status(400).json({ error: "Usuário não possui saldo suficiente" });
      }

      // Atualizar solicitação para aprovada
      await prisma.withdrawalRequest.update({
        where: { id },
        data: {
          status: "approved",
          adminNotes: adminNotes || null,
          processedBy: userId,
          processedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: "Solicitação aprovada com sucesso",
      });

    } catch (err) {
      console.error("[Wallet.approveWithdrawalRequest]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // PUT /api/wallet/withdrawal-requests/:id/reject (REJEITAR SOLICITAÇÃO - ADMIN)
  static async rejectWithdrawalRequest(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verificar se é admin
      const admin = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!admin || !admin.isAdmin) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }

      const { id } = req.params;
      const { adminNotes } = req.body;

      if (!adminNotes) {
        return res.status(400).json({ error: "Motivo da rejeição é obrigatório" });
      }

      const request = await prisma.withdrawalRequest.findUnique({
        where: { id },
      });

      if (!request) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Solicitação já foi processada" });
      }

      // Atualizar solicitação para rejeitada
      await prisma.withdrawalRequest.update({
        where: { id },
        data: {
          status: "rejected",
          adminNotes,
          processedBy: userId,
          processedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: "Solicitação rejeitada",
      });

    } catch (err) {
      console.error("[Wallet.rejectWithdrawalRequest]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // PUT /api/wallet/withdrawal-requests/:id/complete (COMPLETAR SAQUE - ADMIN)
  static async completeWithdrawalRequest(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verificar se é admin
      const admin = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      if (!admin || !admin.isAdmin) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
      }

      const { id } = req.params;

      const request = await prisma.withdrawalRequest.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              balance: true,
            },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      if (request.status !== "approved") {
        return res.status(400).json({ error: "Solicitação precisa estar aprovada para ser completada" });
      }

      if (request.user.balance < request.amount) {
        return res.status(400).json({ error: "Usuário não possui saldo suficiente" });
      }

      // Processar saque: debitar da carteira e criar transação
      await prisma.$transaction(async (tx) => {
        // Atualizar solicitação para completada
        await tx.withdrawalRequest.update({
          where: { id },
          data: {
            status: "completed",
          },
        });

        // Debitar da carteira
        await tx.user.update({
          where: { id: request.userId },
          data: {
            balance: { decrement: request.amount },
            total_withdrawn: { increment: request.amount },
          },
        });

        // Criar transação
        await tx.transaction.create({
          data: {
            userId: request.userId,
            amount: request.amount,
            type: "withdraw",
            status: "completed",
            description: `Saque de R$ ${request.amount.toFixed(2)} - ${request.bankName}`,
          },
        });
      });

      return res.json({
        success: true,
        message: "Saque processado com sucesso",
      });

    } catch (err) {
      console.error("[Wallet.completeWithdrawalRequest]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ======================================================
  // 💰 INICIAR PAGAMENTO DE DEPÓSITO (PIX OU CARTÃO)
  // ======================================================
  static async startDepositPayment(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { type, payer, card, amount, googlePayToken, paymentMethodId } = req.body;

      // Log detalhado dos dados recebidos (para debug)
      console.log("💳 [Wallet Payment] ========== DADOS RECEBIDOS ==========");
      console.log("Tipo:", type);
      console.log("Valor:", amount);
      console.log("Payer completo:", JSON.stringify(payer, null, 2));
      console.log("Payer.firstName:", payer?.firstName, "| Tipo:", typeof payer?.firstName, "| Length:", payer?.firstName?.length);
      console.log("Payer.lastName:", payer?.lastName, "| Tipo:", typeof payer?.lastName, "| Length:", payer?.lastName?.length);
      console.log("Payer.email:", payer?.email, "| Tipo:", typeof payer?.email, "| Length:", payer?.email?.length);
      console.log("Payer.cpf:", payer?.cpf ? "***" : "não informado", "| Tipo:", typeof payer?.cpf, "| Length:", payer?.cpf?.length);
      console.log("Card:", card ? "presente" : "não informado");
      console.log("=============================================");

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Usuário não autenticado" });
      }

      if (!type || !amount) {
        return res
          .status(400)
          .json({ success: false, message: "Tipo de pagamento e valor são obrigatórios" });
      }

      if (!mpAccessToken) {
        console.error("❌ [Wallet Payment] MP_ACCESS_TOKEN não configurado!");
        return res.status(500).json({
          success: false,
          message: "Configuração de pagamento indisponível. Verifique as configurações do servidor.",
        });
      }

      // Verificar se o token está válido (não vazio e tem formato correto)
      if (mpAccessToken.length < 10) {
        console.error("❌ [Wallet Payment] MP_ACCESS_TOKEN inválido (muito curto)!");
        return res.status(500).json({
          success: false,
          message: "Configuração de pagamento inválida. Verifique as configurações do servidor.",
        });
      }

      // BLOQUEAR tokens de teste - APENAS PRODUÇÃO PERMITIDA
      if (mpAccessToken.startsWith("TEST-")) {
        console.error("❌ [Wallet Payment] Token de TESTE detectado!");
        console.error("   ⚠️  APENAS modo de PRODUÇÃO é permitido neste sistema!");
        return res.status(500).json({
          success: false,
          message: "Sistema configurado apenas para produção. Token de teste não permitido. Configure MP_ACCESS_TOKEN com token de produção (começa com APP_USR-).",
        });
      }

      if (!mpAccessToken.startsWith("APP_USR-")) {
        console.error("❌ [Wallet Payment] Token inválido para produção!");
        console.error("   Token deve começar com APP_USR-");
        return res.status(500).json({
          success: false,
          message: "Token de produção inválido. Configure MP_ACCESS_TOKEN com token válido de produção.",
        });
      }

      console.log("✅ [Wallet Payment] Mercado Pago configurado - MODO PRODUÇÃO:", {
        tokenLength: mpAccessToken.length,
        tokenPrefix: mpAccessToken.substring(0, 7),
        mode: "PRODUÇÃO",
        warning: "Transações serão REAIS - dinheiro será transferido",
      });

      if (amount < 1) {
        return res.status(400).json({
          success: false,
          message: "Valor mínimo de depósito é R$ 1,00",
        });
      }

      // ======================================================
      // 🟢 GOOGLE PAY
      // ======================================================
      if (type === "google_pay") {
        if (!googlePayToken) {
          return res.status(400).json({
            success: false,
            message: "Token do Google Pay não fornecido",
          });
        }

        const payerEmail = payer?.email ? String(payer.email).trim() : "";
        if (!payerEmail) {
          return res.status(400).json({
            success: false,
            message: "Email obrigatório para pagamento via Google Pay",
          });
        }

        console.log("📤 [Google Pay] Processando pagamento:", { amount, email: payerEmail });

        try {
          // payment_method_id: usa o informado pelo frontend (brand do cartão) ou "google_pay"
          const gpPaymentMethodId = paymentMethodId || "google_pay";
          console.log("📤 [Google Pay] payment_method_id:", gpPaymentMethodId);

          const payment = await new Payment(mp).create({
            body: {
              transaction_amount: amount,
              token: googlePayToken,
              payment_method_id: gpPaymentMethodId,
              installments: 1,
              description: `Depósito na carteira - R$ ${amount.toFixed(2)}`,
              payer: {
                email: payerEmail,
              },
            } as any,
          });

          console.log("✅ [Google Pay] Resposta do Mercado Pago:", { id: payment.id, status: payment.status });

          const isApproved = payment.status === "approved";
          const isPending = payment.status === "pending";

          await prisma.transaction.create({
            data: {
              userId,
              amount,
              mpPaymentId: String(payment.id),
              status: isApproved ? "completed" : isPending ? "pending" : "rejected",
              type: "deposit",
              description: `Depósito Google Pay de R$ ${amount.toFixed(2)}`,
            },
          });

          if (isApproved) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                balance: { increment: amount },
                total_earned: { increment: amount },
              },
            });
          }

          return res.json({
            success: isApproved || isPending,
            data: {
              paymentId: payment.id,
              paymentStatus: payment.status,
              message: isApproved
                ? "Pagamento aprovado com sucesso!"
                : isPending
                ? "Pagamento em processamento"
                : "Pagamento rejeitado",
            },
          });
        } catch (err: any) {
          // Log detalhado para debug
          const mpCause = err?.cause?.[0];
          const mpStatus = err?.status ?? err?.response?.status;
          const mpDescription = mpCause?.description ?? err?.message ?? "Erro desconhecido";
          const mpCode = mpCause?.code ?? "N/A";

          console.error("❌ [Google Pay] Erro ao processar pagamento:");
          console.error("   Status MP:", mpStatus);
          console.error("   Código MP:", mpCode);
          console.error("   Descrição:", mpDescription);
          console.error("   Erro completo:", JSON.stringify(err?.cause ?? err?.message));

          const userMessage =
            mpStatus === 400 || mpStatus === 422
              ? mpDescription
              : "Erro ao processar pagamento via Google Pay. Tente novamente.";

          return res.status(mpStatus && mpStatus < 500 ? mpStatus : 500).json({
            success: false,
            message: userMessage,
            errorCode: mpCode,
          });
        }
      }

      // Normalizar CPF (apenas números)
      const cpfDigits = String(payer?.cpf || "").replace(/\D/g, "");
      if (!cpfDigits || cpfDigits.length !== 11) {
        return res
          .status(400)
          .json({ success: false, message: "CPF inválido. Informe um CPF válido com 11 dígitos." });
      }

      // Validar CPF usando algoritmo de validação
      // Rejeitar CPFs inválidos conhecidos (todos dígitos iguais)
      if (/^(\d)\1{10}$/.test(cpfDigits)) {
        return res
          .status(400)
          .json({ success: false, message: "CPF inválido. Informe um CPF válido." });
      }

      // Validar CPF usando algoritmo de validação de dígitos verificadores
      function validateCPF(cpf: string): boolean {
        if (cpf.length !== 11) return false;
        
        // Verificar se todos os dígitos são iguais
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        
        // Validar primeiro dígito verificador
        let sum = 0;
        for (let i = 0; i < 9; i++) {
          sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(9))) return false;
        
        // Validar segundo dígito verificador
        sum = 0;
        for (let i = 0; i < 10; i++) {
          sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cpf.charAt(10))) return false;
        
        return true;
      }

      // Validar CPF antes de enviar ao Mercado Pago
      if (!validateCPF(cpfDigits)) {
        console.error("❌ [Wallet Payment] CPF inválido (não passa na validação algorítmica):", cpfDigits);
        return res
          .status(400)
          .json({ success: false, message: "CPF inválido. Verifique os dígitos do CPF e tente novamente." });
      }

      // Validar e obter dados do pagador (priorizar dados do payer, não do card)
      // NÃO usar valores padrão - exigir que todos os campos sejam preenchidos
      const firstNameRaw = payer?.firstName;
      const lastNameRaw = payer?.lastName;
      const emailRaw = payer?.email;

      console.log("🔍 [Wallet Payment] Dados RAW antes do trim:", {
        firstNameRaw,
        lastNameRaw,
        emailRaw,
        firstNameType: typeof firstNameRaw,
        lastNameType: typeof lastNameRaw,
        emailType: typeof emailRaw,
      });

      const firstName = firstNameRaw ? String(firstNameRaw).trim() : "";
      const lastName = lastNameRaw ? String(lastNameRaw).trim() : "";
      const email = emailRaw ? String(emailRaw).trim() : "";

      console.log("🔍 [Wallet Payment] Dados após trim:", {
        firstName,
        lastName,
        email,
        firstNameLength: firstName.length,
        lastNameLength: lastName.length,
        emailLength: email.length,
      });

      // Validar que todos os campos obrigatórios estão preenchidos
      if (!firstName || firstName.length < 2) {
        console.error("❌ [Wallet Payment] VALIDAÇÃO FALHOU - firstName:", {
          firstName,
          length: firstName.length,
          original: firstNameRaw
        });
        return res
          .status(400)
          .json({ success: false, message: "Nome inválido. Informe o nome completo do portador do cartão." });
      }

      if (!lastName || lastName.length < 2) {
        console.error("❌ [Wallet Payment] VALIDAÇÃO FALHOU - lastName:", {
          lastName,
          length: lastName.length,
          original: lastNameRaw
        });
        return res
          .status(400)
          .json({ success: false, message: "Sobrenome inválido. Informe o sobrenome completo." });
      }

      if (!email) {
        console.error("❌ [Wallet Payment] VALIDAÇÃO FALHOU - email:", {
          email,
          length: email.length,
          original: emailRaw
        });
        return res
          .status(400)
          .json({ success: false, message: "Email obrigatório. Informe um email válido." });
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error("❌ [Wallet Payment] VALIDAÇÃO FALHOU - email inválido:", email);
        return res
          .status(400)
          .json({ success: false, message: "Email inválido. Informe um email válido." });
      }

      // Log dos dados validados (sem mostrar CPF completo por segurança)
      console.log("💳 [Wallet Payment] Dados validados do pagador:", {
        firstName,
        lastName,
        email,
        cpfLength: cpfDigits.length,
        cpfPrefix: cpfDigits.substring(0, 3),
        cpfSuffix: cpfDigits.substring(9),
        cpfValidated: true,
      });
      
      // Log detalhado apenas em desenvolvimento para debug
      if (process.env.NODE_ENV === "development") {
        console.log("🔍 [Wallet Payment] CPF completo (DEV ONLY):", cpfDigits);
      }

      // ======================================================
      // 🔵 PIX
      // ======================================================
      if (type === "pix") {
        // Validação final antes de criar pagamento PIX
        const cpfClean = String(cpfDigits).replace(/\D/g, "");
        if (!firstName || !lastName || !email || !cpfClean || cpfClean.length !== 11) {
          console.error("❌ [Wallet Payment PIX] Dados incompletos:", {
            hasFirstName: !!firstName,
            firstName,
            hasLastName: !!lastName,
            lastName,
            hasEmail: !!email,
            email,
            hasCpf: !!cpfClean,
            cpfLength: cpfClean?.length
          });
          return res.status(400).json({
            success: false,
            message: "Dados incompletos. Verifique se preencheu todos os campos (nome, sobrenome, email e CPF).",
          });
        }

        console.log("📤 [Wallet Payment PIX] Enviando pagamento ao Mercado Pago:", {
          email,
          firstName,
          lastName,
          cpfLength: cpfClean.length,
          cpfPrefix: cpfClean.substring(0, 3),
        });

        const payment = await new Payment(mp).create({
          body: {
            transaction_amount: amount,
            payment_method_id: "pix",
            description: `Depósito na carteira - R$ ${amount.toFixed(2)}`,
            payer: {
              first_name: firstName,
              last_name: lastName,
              email,
              identification: {
                type: "CPF",
                number: cpfClean, // Garantir que está limpo
              },
            },
          },
        });

        // Criar transação pendente
        const transaction = await prisma.transaction.create({
          data: {
            userId,
            amount,
            mpPaymentId: String(payment.id),
            status: "pending",
            type: "deposit",
            description: `Depósito de R$ ${amount.toFixed(2)}`,
          },
        });

        return res.json({
          success: true,
          data: {
            paymentId: payment.id,
            transactionId: transaction.id,
            qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64:
              payment.point_of_interaction?.transaction_data?.qr_code_base64,
          },
        });
      }

      // ======================================================
      // 🔵 CARTÃO
      // ======================================================
      if (type === "card") {
        if (!card) {
          return res
            .status(400)
            .json({ success: false, message: "Dados do cartão não enviados" });
        }

        const cardNumber = String(card.number).replace(/\D/g, "");
        if (cardNumber.length < 13) {
          return res
            .status(400)
            .json({ success: false, message: "Número do cartão inválido" });
        }

        if (!card.expiry || !card.cvv) {
          return res.status(400).json({
            success: false,
            message: "Validade e CVV obrigatórios",
          });
        }

        const [monthStr, yearStr] = String(card.expiry).split("/");
        const expiration_month = Number(monthStr);
        const expiration_year = Number(
          yearStr?.length === 2 ? "20" + yearStr : yearStr
        );

        if (
          !expiration_month ||
          expiration_month < 1 ||
          expiration_month > 12 ||
          !expiration_year
        ) {
          return res
            .status(400)
            .json({ success: false, message: "Validade do cartão inválida" });
        }

        // Garantir que o CPF está limpo e validado antes de criar o token
        const cpfForToken = String(cpfDigits).replace(/\D/g, "");
        if (cpfForToken.length !== 11) {
          return res.status(400).json({
            success: false,
            message: "CPF inválido. Informe um CPF válido com 11 dígitos.",
          });
        }

        // Criar TOKEN do cartão
        // IMPORTANTE: Os dados do cardholder devem ser EXATAMENTE os mesmos usados no payer do pagamento
        let token;
        try {
          const cardholderName = `${firstName} ${lastName}`.trim();
          console.log("💳 [Wallet Payment] Criando token do cartão:", {
            cardholderName,
            cpf: cpfForToken.substring(0, 3) + "***" + cpfForToken.substring(9),
            firstName,
            lastName,
          });
          
          token = await new CardToken(mp).create({
            body: {
              card_number: cardNumber,
              expiration_month: String(expiration_month),
              expiration_year: String(expiration_year),
              security_code: card.cvv,
              cardholder: {
                name: cardholderName, // Nome completo (deve corresponder ao payer do pagamento)
                identification: {
                  type: "CPF",
                  number: cpfForToken, // CPF já validado e limpo (deve corresponder ao payer do pagamento)
                },
              },
            } as any, // Type assertion necessário devido a incompatibilidade de tipos do SDK
          });
          console.log("✅ [Wallet Payment] Token criado com sucesso:", token.id);
        } catch (tokenError: any) {
          console.error("❌ [Wallet Payment] Erro ao criar token do cartão:", {
            error: tokenError.message,
            response: tokenError.response?.data,
            status: tokenError.response?.status,
            errorDetails: tokenError.cause,
          });
          
          // Verificar se o erro é relacionado ao CPF no cardholder
          const errorMessage = tokenError.message || "";
          const errorResponse = tokenError.response?.data || {};
          
          let userMessage = "Erro ao processar dados do cartão. Verifique se todos os dados estão corretos.";
          
          if (errorMessage.includes("Invalid user identification") || 
              errorResponse.cause?.some((c: any) => c.code === "3241" || c.code === "3242") ||
              errorResponse.message?.includes("identification")) {
            userMessage = "CPF inválido. Verifique se o CPF informado está correto e tente novamente.";
          } else if (errorMessage.includes("card_number") || errorMessage.includes("Invalid card")) {
            userMessage = "Número do cartão inválido. Verifique os dados do cartão e tente novamente.";
          }
          
          return res.status(400).json({
            success: false,
            message: userMessage,
            error: tokenError.message,
          });
        }

        // Criar PAGAMENTO cartão
        let payment;
        try {
          // Garantir que todos os dados estão presentes e válidos
          // NÃO usar fallback - todos os campos já foram validados anteriormente
          const payerEmail = email; // Já validado anteriormente
          const payerFirstName = firstName; // Já validado anteriormente
          const payerLastName = lastName; // Já validado anteriormente
          const payerCpf = cpfDigits; // Usar o CPF já validado anteriormente

          // Validação final antes de enviar ao Mercado Pago
          if (!payerEmail || !payerFirstName || !payerLastName || !payerCpf || payerCpf.length !== 11) {
            console.error("❌ [Wallet Payment] Dados incompletos antes de criar pagamento:", {
              hasEmail: !!payerEmail,
              email: payerEmail,
              hasFirstName: !!payerFirstName,
              firstName: payerFirstName,
              hasLastName: !!payerLastName,
              lastName: payerLastName,
              hasCpf: !!payerCpf,
              cpfLength: payerCpf?.length
            });
            return res.status(400).json({
              success: false,
              message: "Dados incompletos. Verifique se preencheu todos os campos (nome, sobrenome, email e CPF).",
            });
          }

          // Garantir que o CPF está em formato correto (string, apenas números, 11 dígitos)
          const payerCpfClean = String(payerCpf).replace(/\D/g, "");
          if (payerCpfClean.length !== 11) {
            console.error("❌ [Wallet Payment] CPF inválido após limpeza:", {
              original: payerCpf,
              cleaned: payerCpfClean,
              length: payerCpfClean.length
            });
            return res.status(400).json({
              success: false,
              message: "CPF inválido. Verifique os dados e tente novamente.",
            });
          }

          // Log detalhado dos dados que serão enviados ao Mercado Pago
          console.log("📤 [Wallet Payment] Enviando pagamento ao Mercado Pago:", {
            email: payerEmail,
            firstName: payerFirstName,
            lastName: payerLastName,
            cpfLength: payerCpfClean.length,
            cpfPrefix: payerCpfClean.substring(0, 3),
          });

          // IMPORTANTE: Os dados do payer devem ser EXATAMENTE os mesmos usados no cardholder do token
          // O nome deve ser o mesmo formato: "firstName lastName" (mesmo usado no token)
          const payerFullName = `${payerFirstName} ${payerLastName}`.trim();
          
          // Verificar se o nome corresponde ao usado no token
          const tokenCardholderName = `${firstName} ${lastName}`.trim();
          if (payerFullName !== tokenCardholderName) {
            console.error("❌ [Wallet Payment] Nome do payer não corresponde ao nome do cardholder do token:", {
              tokenCardholderName,
              payerFullName,
            });
          }
          
          // Verificar se o CPF corresponde ao usado no token
          if (payerCpfClean !== cpfDigits) {
            console.error("❌ [Wallet Payment] CPF do payer não corresponde ao CPF do cardholder do token:", {
              tokenCpf: cpfDigits.substring(0, 3) + "***",
              payerCpf: payerCpfClean.substring(0, 3) + "***",
            });
          }
          
          const payerData = {
            email: payerEmail,
            first_name: payerFirstName, // Deve corresponder ao firstName usado no token
            last_name: payerLastName,   // Deve corresponder ao lastName usado no token
            identification: {
              type: "CPF",
              number: payerCpfClean, // Deve corresponder ao CPF usado no token
            },
          };

          // Log dos dados que serão enviados (sem mostrar CPF completo por segurança)
          console.log("💳 [Wallet Payment] Dados do pagador que serão enviados:", {
            email: payerEmail,
            first_name: payerFirstName,
            last_name: payerLastName,
            identification: {
              type: "CPF",
              number: payerCpfClean.substring(0, 3) + "***" + payerCpfClean.substring(9), // Mostrar apenas parcialmente
              length: payerCpfClean.length
            }
          });

          // Preparar payload completo para o Mercado Pago
          // NOTA: 
          // - currency_id não é aceito pela API - a moeda é definida automaticamente pelo Access Token
          // - payment_method_id não é necessário quando usamos token - o MP detecta automaticamente
          const paymentBody: any = {
            transaction_amount: amount,
            token: token.id,
            description: `Depósito na carteira - R$ ${amount.toFixed(2)}`,
            installments: 1,
            payer: payerData,
            // Campos adicionais recomendados
            statement_descriptor: "DEPOSITO",
            capture: true, // Capturar o pagamento imediatamente
          };

          // Log do payload completo (sem mostrar dados sensíveis)
          console.log("📤 [Wallet Payment] Payload completo sendo enviado:", {
            transaction_amount: paymentBody.transaction_amount,
            token: paymentBody.token ? "***" + paymentBody.token.slice(-8) : "não informado",
            description: paymentBody.description,
            installments: paymentBody.installments,
            payer: {
              email: payerData.email,
              first_name: payerData.first_name,
              last_name: payerData.last_name,
              identification_type: payerData.identification.type,
              identification_number: payerData.identification.number ? "***" : "não informado",
            },
            statement_descriptor: paymentBody.statement_descriptor,
            capture: paymentBody.capture,
          });

          payment = await new Payment(mp).create({
            body: paymentBody,
          });
        } catch (paymentError: any) {
          console.error("❌ [Wallet Payment] Erro ao criar pagamento:", {
            error: paymentError.message,
            response: paymentError.response?.data,
            status: paymentError.response?.status,
            errorDetails: paymentError.cause,
          });
          
          // Log detalhado do erro da API do Mercado Pago
          if (paymentError.response?.data) {
            console.error("❌ [Wallet Payment] Detalhes do erro do Mercado Pago:", {
              message: paymentError.response.data.message,
              error: paymentError.response.data.error,
              status: paymentError.response.data.status,
              cause: paymentError.response.data.cause,
            });
          }

          // Verificar tipo específico de erro
          const errorMessage = paymentError.message || "";
          const errorResponse = paymentError.response?.data || {};
          const errorCode = paymentError.cause?.[0]?.code || paymentError.errorDetails?.[0]?.code || errorResponse.cause?.[0]?.code;
          
          console.error("❌ [Wallet Payment] Código de erro:", errorCode);
          console.error("❌ [Wallet Payment] Mensagem de erro:", errorMessage);
          console.error("❌ [Wallet Payment] Error Details:", paymentError.errorDetails);
          
          let userMessage = "Erro ao processar pagamento. Verifique os dados e tente novamente.";
          
          // Erro específico: diff_param_bins (código 10103) - dados do cartão não correspondem aos dados do pagador
          if (errorMessage.includes("diff_param_bins") || errorCode === 10103 || errorCode === "10103") {
            userMessage = "Os dados do cartão não correspondem aos dados do pagador. Verifique se o nome e CPF informados correspondem exatamente ao titular do cartão e tente novamente.";
          } else if (errorMessage.includes("Invalid user identification") || 
              errorResponse.cause?.some((c: any) => c.code === "3241" || c.code === "3242") ||
              errorResponse.message?.includes("identification")) {
            userMessage = "CPF inválido. Verifique se o CPF informado está correto e tente novamente.";
          } else if (errorMessage.includes("card") || errorResponse.cause?.some((c: any) => c.code?.startsWith("E"))) {
            userMessage = "Erro ao processar dados do cartão. Verifique os dados do cartão e tente novamente.";
          }

          return res.status(400).json({
            success: false,
            message: userMessage,
            error: paymentError.message,
          });
        }

        // Log detalhado do pagamento
        console.log("💳 [Wallet Payment] Status do pagamento:", payment.status);
        console.log("💳 [Wallet Payment] Payment ID:", payment.id);
        console.log("💳 [Wallet Payment] Payment completo:", JSON.stringify(payment, null, 2));
        
        // Log dos dados do payer retornados pelo Mercado Pago
        console.log("🔍 [Wallet Payment] Dados do payer retornados pelo Mercado Pago:", {
          hasPayer: !!payment.payer,
          payerEmail: payment.payer?.email,
          payerFirstName: payment.payer?.first_name,
          payerLastName: payment.payer?.last_name,
          payerIdentification: payment.payer?.identification,
          payerComplete: payment.payer ? JSON.stringify(payment.payer, null, 2) : "não retornado",
        });
        
        if (payment.status === "rejected") {
          const rejectionReason = payment.status_detail || "Pagamento rejeitado pelo processador";
          const errorMessage = payment.status_detail || "Motivo não especificado";
          
          // Log detalhado do motivo da rejeição
          console.error("❌ [Wallet Payment] ========== PAGAMENTO REJEITADO ==========");
          console.error("Payment ID:", payment.id);
          console.error("Status:", payment.status);
          console.error("Status Detail:", payment.status_detail);
          console.error("Rejection Reason:", rejectionReason);
          console.error("Error Message:", errorMessage);
          console.error("Status detail:", payment.status_detail);
          console.error("Payment Method:", payment.payment_method);
          console.error("Last 4 digits:", payment.card?.last_four_digits);
          console.error("Live Mode:", payment.live_mode);
          console.error("Authorization Code:", payment.authorization_code);
          
          // Informações sobre o cartão
          if (payment.card) {
            console.error("Card Info:", {
              id: payment.card.id,
              first_six_digits: payment.card.first_six_digits,
              last_four_digits: payment.card.last_four_digits,
              expiration_month: payment.card.expiration_month,
              expiration_year: payment.card.expiration_year,
            });
          }
          
          // Se for modo de teste, dar dica sobre cartões de teste
          if (!payment.live_mode) {
            console.error("⚠️ MODO DE TESTE DETECTADO");
            console.error("💡 DICA: Para testes, use os cartões de teste do Mercado Pago:");
            console.error("   - Aprova: 5031 4332 1540 6351 (Mastercard)");
            console.error("   - Aprova: 5031 7557 3453 0604 (Mastercard)");
            console.error("   - Aprova: 4509 9535 6623 3704 (Visa)");
            console.error("   - Rejeita: 5031 4332 1540 6352 (Mastercard)");
          }
          
          console.error("==========================================");
          
          console.error("❌ [Wallet Payment] Pagamento rejeitado (resumo):", {
            paymentId: payment.id,
            status: payment.status,
            statusDetail: payment.status_detail,
            cause: payment.status_detail || null,
            rejectionReason,
            errorMessage,
            paymentMethod: payment.payment_method,
            paymentTypeId: payment.payment_type_id,
            operationType: payment.operation_type,
            liveMode: payment.live_mode,
            cardLast4: payment.card?.last_four_digits,
          });
        }

        // Criar transação com descrição detalhada se rejeitado
        const transactionDescription = payment.status === "rejected"
          ? `Depósito de R$ ${amount.toFixed(2)} - Rejeitado: ${payment.status_detail || "Motivo não informado"}`
          : `Depósito de R$ ${amount.toFixed(2)}`;

        const transaction = await prisma.transaction.create({
          data: {
            userId,
            amount,
            mpPaymentId: String(payment.id),
            status: payment.status, // "approved", "rejected", "pending", etc
            type: "deposit",
            description: transactionDescription,
          },
        });

        // Se aprovado, creditar na carteira
        if (payment.status === "approved") {
          await prisma.user.update({
            where: { id: userId },
            data: {
              balance: { increment: amount },
              total_earned: { increment: amount },
            },
          });

          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "completed" },
          });
        }

        // Mensagem baseada no status
        let message = "Pagamento em processamento";
        if (payment.status === "approved") {
          message = "Depósito aprovado e creditado na carteira!";
        } else if (payment.status === "rejected") {
          // Mapear códigos de erro para mensagens amigáveis
          const statusDetail = payment.status_detail || "";
          let userFriendlyMessage = "Pagamento rejeitado";
          
          // Log detalhado: DADOS ENVIADOS (prioritário)
          console.log("📤 [Wallet Payment] ========== DADOS ENVIADOS AO MERCADO PAGO ==========");
          console.log("Nome completo:", `${firstName} ${lastName}`);
          console.log("Primeiro nome:", firstName, "| Tipo:", typeof firstName, "| Length:", firstName?.length);
          console.log("Sobrenome:", lastName, "| Tipo:", typeof lastName, "| Length:", lastName?.length);
          console.log("Email:", email, "| Tipo:", typeof email, "| Length:", email?.length);
          console.log("CPF:", cpfDigits ? `${cpfDigits.substring(0, 3)}***${cpfDigits.substring(9)}` : "não informado", "| Length:", cpfDigits?.length);
          console.log("Todos os dados enviados são válidos:", !!(firstName && lastName && email && cpfDigits && cpfDigits.length === 11));
          console.log("=============================================");
          
          // Log: DADOS RETORNADOS pelo Mercado Pago (usar dados enviados se MP retornar null)
          console.log("📥 [Wallet Payment] ========== DADOS DO PAGADOR (RETORNADOS / ENVIADOS) ==========");
          console.log("Status Detail:", statusDetail);
          console.log("Payer retornado pelo MP:", payment.payer ? "Sim" : "Não");
          
          // Usar dados retornados pelo MP se disponíveis, caso contrário usar dados enviados
          const payerEmail = payment.payer?.email || email || "não disponível";
          const payerFirstName = payment.payer?.first_name || firstName || "não disponível";
          const payerLastName = payment.payer?.last_name || lastName || "não disponível";
          const payerCpf = payment.payer?.identification?.number || cpfDigits || "não disponível";
          const dataSource = payment.payer?.email ? "Mercado Pago" : "Dados enviados (MP retornou null)";
          
          console.log("Email:", payerEmail, `(${dataSource})`);
          console.log("Primeiro Nome:", payerFirstName, `(${dataSource})`);
          console.log("Sobrenome:", payerLastName, `(${dataSource})`);
          console.log("CPF:", payerCpf ? `${payerCpf.substring(0, 3)}***${payerCpf.substring(payerCpf.length - 2)}` : "não disponível", `(${dataSource})`);
          if (!payment.payer?.email) {
            console.log("ℹ️  Mercado Pago retornou dados null - usando dados enviados pelo usuário");
          }
          console.log("=============================================");
          
          // NÃO confiar apenas nos dados retornados pelo Mercado Pago
          // O Mercado Pago pode não retornar os dados do payer em algumas rejeições
          // Verificar se ENVIAMOS dados válidos, não se o MP retornou
          const weSentValidData = firstName && lastName && email && cpfDigits && cpfDigits.length === 11;
          
          console.log("✅ [Wallet Payment] Validação final:", {
            dadosEnviadosValidos: weSentValidData,
            statusDetail: statusDetail,
            motivoRejeicao: statusDetail || "não especificado",
          });
          
          switch (statusDetail) {
            case "cc_rejected_high_risk":
              // Rejeição por alto risco - geralmente não é problema de dados
              if (!weSentValidData) {
                userFriendlyMessage = "Pagamento rejeitado por segurança. Verifique se todos os dados foram preenchidos corretamente (nome completo, email e CPF).";
              } else {
                userFriendlyMessage = "Pagamento rejeitado pelo sistema de segurança. Isso pode acontecer por várias razões: cartão novo, padrão incomum de transação, ou políticas de segurança. Tente novamente mais tarde ou use outro cartão.";
              }
              break;
            case "cc_rejected_other_reason":
              // "cc_rejected_other_reason" é um motivo genérico de rejeição
              // Se enviamos dados válidos, o problema não é dados incompletos
              if (!weSentValidData) {
                userFriendlyMessage = "Dados do pagador incompletos. Verifique se preencheu todos os campos (nome, email e CPF) corretamente.";
              } else {
                // Dados válidos enviados - o problema é com o cartão (pode ser cartão de teste inválido, limite, etc.)
                userFriendlyMessage = "Cartão rejeitado. Verifique se os dados do cartão estão corretos, se o cartão tem limite disponível, ou tente outro cartão. Nota: Para testes, use cartões de teste válidos do Mercado Pago.";
              }
              break;
            case "cc_rejected_bad_filled_security_code":
              userFriendlyMessage = "CVV inválido. Verifique o código de segurança do cartão (3 ou 4 dígitos).";
              break;
            case "cc_rejected_bad_filled_card_number":
              userFriendlyMessage = "Número do cartão inválido. Verifique os dados do cartão.";
              break;
            case "cc_rejected_bad_filled_date":
              userFriendlyMessage = "Data de validade inválida. Verifique a data de expiração do cartão (MM/AA).";
              break;
            case "cc_rejected_insufficient_amount":
              userFriendlyMessage = "Saldo insuficiente no cartão. Verifique o limite disponível.";
              break;
            case "cc_rejected_call_for_authorize":
              userFriendlyMessage = "Cartão requer autorização. Entre em contato com seu banco.";
              break;
            case "cc_rejected_expired":
              userFriendlyMessage = "Cartão expirado. Use um cartão com data de validade futura.";
              break;
            default:
              const errorDesc = payment.status_detail || "Motivo não especificado";
              userFriendlyMessage = `Pagamento rejeitado: ${errorDesc}`;
          }
          
          message = userFriendlyMessage;
        }

        return res.json({
          success: payment.status === "approved",
          data: {
            paymentId: payment.id,
            transactionId: transaction.id,
            paymentStatus: payment.status,
            statusDetail: payment.status_detail,
            message,
          },
        });
      }

      return res
        .status(400)
        .json({ success: false, message: "Método de pagamento inválido" });
    } catch (err: any) {
      console.error("❌ ERRO START DEPOSIT PAYMENT:", err);
      
      // Verificar se é erro específico de PIX não habilitado
      const errorMessage = err?.message || "";
      const errorCode = err?.cause?.[0]?.code;
      const isPixKeyNotEnabled = 
        errorMessage.includes("Collector user without key enabled for QR") ||
        errorMessage.includes("key enabled for QR") ||
        errorCode === 13253;

      if (err?.response) {
        console.error("Status MP:", err.response.status);
        console.error("Data MP:", err.response.data);
      }

      // Tratamento específico para erro de chave PIX não habilitada
      if (isPixKeyNotEnabled) {
        console.error("⚠️ [PIX] Chave PIX não habilitada na conta do Mercado Pago");
        console.error("   Para habilitar:");
        console.error("   1. Acesse https://www.mercadopago.com.br/developers/panel");
        console.error("   2. Vá em 'Suas integrações' > 'Configurações'");
        console.error("   3. Habilite 'Chave PIX' na sua conta");
        console.error("   4. Ou configure uma chave PIX no painel do Mercado Pago");
        
        return res.status(400).json({
          success: false,
          message: "Pagamento PIX não disponível no momento",
          error: "A chave PIX não está habilitada na conta do Mercado Pago. Entre em contato com o suporte ou use pagamento com cartão.",
          errorCode: "PIX_KEY_NOT_ENABLED",
          details: "Para habilitar PIX, acesse o painel do Mercado Pago e configure uma chave PIX na sua conta.",
        });
      }

      // Tratamento para erros de política (403) - método de pagamento não habilitado na conta
      const errStatus = err?.status ?? err?.response?.status;
      if (errStatus === 403 || err?.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES") {
        console.error("⚠️ [Mercado Pago] Método de pagamento bloqueado por política (403)");
        console.error("   code:", err?.code);
        console.error("   blocked_by:", err?.blocked_by);
        console.error("   Solução: habilite o método de pagamento no painel do Mercado Pago");
        return res.status(400).json({
          success: false,
          message: "Este método de pagamento não está disponível. Verifique as configurações da sua conta no Mercado Pago ou use outro método.",
          errorCode: err?.code || "MP_POLICY_BLOCKED",
        });
      }

      // Tratamento para outros erros do Mercado Pago
      if (errStatus === 400) {
        const mpError = err?.cause?.[0] || err?.response?.data;
        return res.status(400).json({
          success: false,
          message: mpError?.description || err?.message || "Erro ao processar pagamento no Mercado Pago",
          error: err?.message,
          errorCode: mpError?.code || "MP_ERROR",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao iniciar pagamento. Tente novamente mais tarde.",
        error: err?.message,
      });
    }
  }

  // ======================================================
  // 🟩 CONFIRMAR PAGAMENTO PIX DE DEPÓSITO
  // ======================================================
  static async confirmDepositPayment(req: AuthRequest, res: Response) {
    try {
      const { paymentId } = req.body;
      const userId = req.userId;

      if (!paymentId) {
        return res
          .status(400)
          .json({ success: false, message: "paymentId obrigatório" });
      }

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Usuário não autenticado" });
      }

      const payment = await new Payment(mp).get({ id: paymentId });

      if (payment.status !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Pagamento não aprovado ainda",
          status: payment.status,
        });
      }

      const transaction = await prisma.transaction.findFirst({
        where: {
          mpPaymentId: String(paymentId),
          userId,
          type: "deposit",
        },
      });

      if (!transaction) {
        return res
          .status(404)
          .json({ success: false, message: "Transação não encontrada" });
      }

      if (transaction.status === "completed") {
        return res.json({
          success: true,
          message: "Depósito já foi processado anteriormente",
        });
      }

      // Atualizar transação e creditar na carteira
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "completed" },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { increment: transaction.amount },
          total_earned: { increment: transaction.amount },
        },
      });

      return res.json({
        success: true,
        data: {
          message: "Depósito confirmado e creditado na carteira!",
          amount: transaction.amount,
        },
      });
    } catch (err: any) {
      console.error("❌ ERRO CONFIRM DEPOSIT PIX:", err?.response?.data || err);
      return res.status(500).json({
        success: false,
        message: "Erro ao confirmar pagamento",
        error: err?.message,
      });
    }
  }

  // ======================================================
  // 🔔 WEBHOOK DO MERCADO PAGO (NOTIFICAÇÕES AUTOMÁTICAS)
  // ======================================================
  static async webhook(req: Request, res: Response): Promise<void> {
    try {
      // Validar assinatura secreta se estiver configurada (opcional mas recomendado)
      const webhookSecret = process.env.MP_WEBHOOK_SECRET || process.env.MERCADOPAGO_WEBHOOK_SECRET;
      const xSignature = req.headers["x-signature"] as string;
      const xRequestId = req.headers["x-request-id"] as string;

      // Validar assinatura do webhook usando HMAC-SHA256
      if (webhookSecret && xSignature) {
        try {
          // O Mercado Pago envia a assinatura no formato: "sha256=hash"
          const parts = xSignature.split("=");
          if (parts.length !== 2 || parts[0] !== "sha256") {
            console.error("❌ [Webhook] Formato de assinatura inválido:", xSignature);
            res.status(401).json({ error: "Assinatura inválida" });
            return;
          }

          const receivedSignature = parts[1];
          
          // O body raw já foi capturado no middleware express.json
          const rawBody = (req as any).rawBody || JSON.stringify(req.body);
          
          // Calcular hash HMAC-SHA256
          const calculatedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawBody)
            .digest("hex");

          // Comparação segura contra timing attacks
          const isValid = crypto.timingSafeEqual(
            Buffer.from(receivedSignature),
            Buffer.from(calculatedSignature)
          );

          if (!isValid) {
            console.error("❌ [Webhook] Assinatura inválida - possível tentativa de fraude!");
            console.error("   Recebida:", receivedSignature.substring(0, 16) + "...");
            console.error("   Esperada:", calculatedSignature.substring(0, 16) + "...");
            res.status(401).json({ error: "Assinatura inválida" });
            return;
          }

          console.log("✅ [Webhook] Assinatura validada com sucesso!");
        } catch (error: any) {
          console.error("❌ [Webhook] Erro ao validar assinatura:", error.message);
          res.status(500).json({ error: "Erro ao validar assinatura" });
          return;
        }
      } else if (webhookSecret && !xSignature) {
        console.warn("⚠️ [Webhook] Assinatura secreta configurada mas header x-signature não encontrado");
        // Em produção, é recomendado rejeitar, mas vamos apenas avisar para não quebrar
        // Descomente a linha abaixo para rejeitar em produção:
        // return res.status(401).json({ error: "Assinatura não fornecida" });
      } else if (!webhookSecret) {
        console.warn("⚠️ [Webhook] MP_WEBHOOK_SECRET não configurado - webhook sem validação de assinatura");
      }

      // O Mercado Pago envia notificações no formato:
      // { type: "payment", data: { id: "123456789" } }
      const { type, data } = req.body;

      console.log("🔔 [Webhook] Notificação recebida:", { 
        type, 
        data,
        requestId: xRequestId,
        hasSignature: !!xSignature
      });

      // Responder imediatamente ao Mercado Pago (200 OK)
      // para evitar que ele tente reenviar a notificação
      res.status(200).json({ received: true });

      // Processar a notificação de forma assíncrona (não bloqueia a resposta)

      // Processar a notificação de forma assíncrona (não bloqueia a resposta)
      setImmediate(async () => {
        try {
          if (type !== "payment" || !data?.id) {
            console.log("⚠️ [Webhook] Tipo de notificação não suportado ou dados inválidos");
            return;
          }

          const paymentId = String(data.id);
          console.log("🔍 [Webhook] Processando pagamento:", paymentId);

          // Buscar o pagamento no Mercado Pago para obter o status atualizado
          const payment = await new Payment(mp).get({ id: paymentId });

          console.log("📊 [Webhook] Status do pagamento:", {
            paymentId,
            status: payment.status,
            statusDetail: payment.status_detail,
          });

          // Buscar a transação no banco de dados
          const transaction = await prisma.transaction.findFirst({
            where: {
              mpPaymentId: paymentId,
              type: "deposit",
            },
          });

          if (!transaction) {
            console.log("⚠️ [Webhook] Transação não encontrada para paymentId:", paymentId);
            return;
          }

          // Se o pagamento foi aprovado e a transação ainda não foi processada
          if (payment.status === "approved" && transaction.status !== "completed") {
            console.log("✅ [Webhook] Pagamento aprovado! Creditando na carteira...");

            // Atualizar transação
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: "completed" },
            });

            // Creditar na carteira do usuário
            if (!transaction.userId) {
              console.error("❌ [Webhook] Transaction sem userId:", transaction.id);
              return;
            }
            await prisma.user.update({
              where: { id: transaction.userId },
              data: {
                balance: { increment: transaction.amount },
                total_earned: { increment: transaction.amount },
              },
            });

            console.log("✅ [Webhook] Depósito processado com sucesso!", {
              transactionId: transaction.id,
              userId: transaction.userId,
              amount: transaction.amount,
            });
          } else if (payment.status === "rejected" && transaction.status === "pending") {
            // Atualizar status para rejeitado
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: { status: "rejected" },
            });

            console.log("❌ [Webhook] Pagamento rejeitado:", {
              transactionId: transaction.id,
              statusDetail: payment.status_detail,
            });
          } else {
            console.log("ℹ️ [Webhook] Status não requer ação:", {
              paymentStatus: payment.status,
              transactionStatus: transaction.status,
            });
          }
        } catch (error: any) {
          console.error("❌ [Webhook] Erro ao processar notificação:", error);
        }
      });
      
      // Retorno explícito após iniciar processamento assíncrono
      return;
    } catch (error: any) {
      console.error("❌ [Webhook] Erro ao receber webhook:", error);
      // Sempre retornar 200 para o Mercado Pago, mesmo em caso de erro
      // para evitar que ele tente reenviar a notificação
      res.status(200).json({ received: true, error: error.message });
      return;
    }
  }
}
