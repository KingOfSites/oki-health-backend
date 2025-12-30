import { Request, Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { MercadoPagoConfig, Payment, CardToken } from "mercadopago";

// ======================================================
// 🔑 CONFIG MERCADO PAGO
// ======================================================
const mpAccessToken =
  process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;

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

      return res.json(transactions);

    } catch (err) {
      console.error("[Wallet.getTransactions]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // POST /api/wallet/withdraw
  static async withdraw(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.balance < amount) {
        return res.status(400).json({ error: "Saldo insuficiente" });
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount,
          type: "withdraw",
          status: "completed",
          description: `Saque de R$ ${amount.toFixed(2)}`,
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: amount },
          total_withdrawn: { increment: amount },
        },
      });

      return res.json({ success: true, id: transaction.id });

    } catch (err) {
      console.error("[Wallet.withdraw]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // ======================================================
  // 💰 INICIAR PAGAMENTO DE DEPÓSITO (PIX OU CARTÃO)
  // ======================================================
  static async startDepositPayment(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;
      const { type, payer, card, amount } = req.body;

      // Log dos dados recebidos
      console.log("💳 [Wallet Payment] Dados recebidos:", {
        type,
        amount,
        payer: payer ? {
          firstName: payer.firstName,
          lastName: payer.lastName,
          email: payer.email,
          cpf: payer.cpf ? "***" : "não informado",
        } : "não informado",
        card: card ? {
          number: card.number ? "***" + card.number.slice(-4) : "não informado",
          expiry: card.expiry,
          cvv: card.cvv ? "***" : "não informado",
        } : "não informado",
      });

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
        return res.status(500).json({
          success: false,
          message: "Configuração de pagamento indisponível",
        });
      }

      if (amount < 1) {
        return res.status(400).json({
          success: false,
          message: "Valor mínimo de depósito é R$ 1,00",
        });
      }

      // Normalizar CPF (apenas números)
      const cpfDigits = String(payer?.cpf || "").replace(/\D/g, "");
      if (!cpfDigits || cpfDigits.length !== 11) {
        return res
          .status(400)
          .json({ success: false, message: "CPF inválido. Informe um CPF válido com 11 dígitos." });
      }

      // Validar e obter dados do pagador (priorizar dados do payer, não do card)
      const firstName = payer?.firstName?.trim() || "Teste";
      const lastName = payer?.lastName?.trim() || "Usuario";
      const email = payer?.email?.trim() || "teste@teste.com";

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res
          .status(400)
          .json({ success: false, message: "Email inválido. Informe um email válido." });
      }

      // Log dos dados validados
      console.log("💳 [Wallet Payment] Dados validados do pagador:", {
        firstName,
        lastName,
        email,
        cpfDigits,
        cpfLength: cpfDigits.length,
      });

      // ======================================================
      // 🔵 PIX
      // ======================================================
      if (type === "pix") {
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
                number: cpfDigits,
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

        // Criar TOKEN do cartão
        let token;
        try {
          token = await new CardToken(mp).create({
            body: {
              card_number: cardNumber,
              expiration_month,
              expiration_year,
              security_code: card.cvv,
              cardholder: {
                name: `${firstName} ${lastName}`,
                identification: {
                  type: "CPF",
                  number: cpfDigits,
                },
              },
            },
          });
          console.log("✅ [Wallet Payment] Token criado com sucesso:", token.id);
        } catch (tokenError: any) {
          console.error("❌ [Wallet Payment] Erro ao criar token do cartão:", {
            error: tokenError.message,
            response: tokenError.response?.data,
            status: tokenError.response?.status,
          });
          return res.status(400).json({
            success: false,
            message: "Erro ao processar dados do cartão. Verifique se todos os dados estão corretos.",
            error: tokenError.message,
          });
        }

        // Criar PAGAMENTO cartão
        let payment;
        try {
          // Garantir que todos os dados estão presentes e válidos
          const payerEmail = email || "teste@teste.com";
          const payerFirstName = firstName || "Teste";
          const payerLastName = lastName || "Usuario";
          const payerCpf = cpfDigits || "12345678909";

          const payerData = {
            email: payerEmail,
            first_name: payerFirstName,
            last_name: payerLastName,
            identification: {
              type: "CPF",
              number: payerCpf,
            },
          };

          // Log dos dados que serão enviados
          console.log("💳 [Wallet Payment] Dados do pagador que serão enviados:", JSON.stringify(payerData, null, 2));

          payment = await new Payment(mp).create({
            body: {
              transaction_amount: amount,
              token: token.id,
              description: `Depósito na carteira - R$ ${amount.toFixed(2)}`,
              installments: 1,
              payer: payerData,
            },
          });
        } catch (paymentError: any) {
          console.error("❌ [Wallet Payment] Erro ao criar pagamento:", {
            error: paymentError.message,
            response: paymentError.response?.data,
            status: paymentError.response?.status,
          });
          return res.status(400).json({
            success: false,
            message: "Erro ao processar pagamento. Verifique os dados e tente novamente.",
            error: paymentError.message,
          });
        }

        // Log detalhado do pagamento
        console.log("💳 [Wallet Payment] Status do pagamento:", payment.status);
        console.log("💳 [Wallet Payment] Payment ID:", payment.id);
        console.log("💳 [Wallet Payment] Payment completo:", JSON.stringify(payment, null, 2));
        
        if (payment.status === "rejected") {
          const rejectionReason = payment.status_detail || payment.cause?.[0]?.description || "Pagamento rejeitado pelo processador";
          const errorMessage = payment.cause?.[0]?.description || payment.status_detail || "Motivo não especificado";
          
          console.error("❌ [Wallet Payment] Pagamento rejeitado:", {
            paymentId: payment.id,
            status: payment.status,
            statusDetail: payment.status_detail,
            cause: payment.cause,
            rejectionReason,
            errorMessage,
            // Informações adicionais que podem ajudar
            paymentMethod: payment.payment_method,
            paymentTypeId: payment.payment_type_id,
            operationType: payment.operation_type,
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
          
          // Verificar se os dados do pagador estão faltando
          const hasPayerData = payment.payer?.email && payment.payer?.first_name && payment.payer?.identification?.number;
          
          switch (statusDetail) {
            case "cc_rejected_other_reason":
              if (!hasPayerData) {
                userFriendlyMessage = "Dados do pagador incompletos. Verifique se preencheu todos os campos (nome, email e CPF) corretamente.";
              } else {
                userFriendlyMessage = "Cartão rejeitado. Verifique se os dados do cartão estão corretos ou tente outro cartão.";
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
              const errorDesc = payment.cause?.[0]?.description || payment.status_detail || "Motivo não especificado";
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
      if (err?.response) {
        console.error("Status MP:", err.response.status);
        console.error("Data MP:", err.response.data);
      }
      return res.status(500).json({
        success: false,
        message: "Erro ao iniciar pagamento",
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
}
