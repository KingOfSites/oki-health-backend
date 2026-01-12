import { Request, Response } from "express";
import prisma from "../config/database";
import { MercadoPagoConfig, Payment, CardToken } from "mercadopago";

// ======================================================
// 🔑 CONFIG MERCADO PAGO - APENAS PRODUÇÃO
// ======================================================
const mpAccessToken =
  process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!mpAccessToken) {
  console.error("❌ [Challenge Payment] MP_ACCESS_TOKEN não configurado!");
  console.error("   Configure a variável MP_ACCESS_TOKEN no arquivo .env");
} else {
  // BLOQUEAR tokens de teste - APENAS PRODUÇÃO PERMITIDA
  if (mpAccessToken.startsWith("TEST-")) {
    console.error("❌ [Challenge Payment] ERRO: Token de TESTE detectado!");
    console.error("   ⚠️  APENAS tokens de PRODUÇÃO são permitidos neste sistema!");
    console.error("   Configure MP_ACCESS_TOKEN com token de PRODUÇÃO (começa com APP_USR-)");
    throw new Error("Token de teste não permitido. Use apenas token de produção.");
  }
  
  if (!mpAccessToken.startsWith("APP_USR-")) {
    console.error("❌ [Challenge Payment] Token inválido para produção!");
    console.error("   Token deve começar com APP_USR-");
    throw new Error("Token de produção inválido.");
  }
  
  console.log(`✅ [Challenge Payment] Mercado Pago configurado - MODO PRODUÇÃO`);
}

const mp = new MercadoPagoConfig({
  accessToken: mpAccessToken || "",
});

export class ChallengePaymentController {
  // ======================================================
  // 🔵 INICIAR PAGAMENTO (PIX OU CARTÃO)
  // ======================================================
  static async start(req: any, res: Response) {
    try {
      const userId = req.userId;
      const { type, payer, card } = req.body;
      const { challengeId } = req.params;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Usuário não autenticado" });
      }

      if (!type) {
        return res
          .status(400)
          .json({ success: false, message: "Tipo de pagamento não informado" });
      }

      // Buscar desafio
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
      });

      if (!challenge) {
        return res
          .status(404)
          .json({ success: false, message: "Desafio não encontrado" });
      }

      const entry = challenge.entryPriceCents ?? 0;
      const entryAmount = entry / 100; // valor de entrada em R$ (sem taxa para carteira)
      const fee = 1500; // taxa fixa (em centavos) - apenas para PIX/Cartão
      const amountWithFee = (entry + fee) / 100; // valor em R$ com taxa (para PIX/Cartão)

      // ======================================================
      // 🔒 VERIFICAR SE JÁ EXISTE PAGAMENTO APROVADO E SE ESTÁ PARTICIPANDO
      // ======================================================
      const alreadyPaid = await prisma.transaction.findFirst({
        where: {
          userId,
          challengeId,
          type: "challenge_entry",
          status: "approved",
        },
      });

      // Verificar se o usuário já está participando do desafio
      const isParticipating = await prisma.challengeParticipant.findUnique({
        where: {
          userId_challengeId: {
            userId,
            challengeId,
          },
        },
      });

      // Se já pagou E já está participando, não precisa processar novamente
      if (alreadyPaid && isParticipating) {
        console.log(`ℹ️ [Wallet Payment] Pagamento já realizado e usuário já está participando. Transação ID: ${alreadyPaid.id}`);
        return res.json({
          success: true,
          message: "Pagamento já realizado anteriormente",
          alreadyParticipating: true,
        });
      }

      // Se existe transação mas não está participando, ou se não existe transação, processar pagamento
      if (alreadyPaid && !isParticipating) {
        console.log(`⚠️ [Wallet Payment] Existe transação aprovada mas usuário não está participando. Processando participação...`);
        // Continuar para processar a participação
      }

      // ======================================================
      // 💰 PAGAMENTO COM CARTEIRA
      // ======================================================
      if (type === "wallet") {
        // Se já existe transação aprovada mas usuário não está participando, 
        // pode ser que o débito não aconteceu. Vamos processar o pagamento normalmente.
        if (alreadyPaid && !isParticipating) {
          console.log(`⚠️ [Wallet Payment] Transação existe mas usuário não está participando. Processando pagamento completo (pode debitar novamente se necessário)...`);
        }
        // Buscar saldo do usuário
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "Usuário não encontrado",
          });
        }

        console.log(`💰 [Wallet Payment] Usuário: ${userId}, Saldo atual: R$ ${user.balance.toFixed(2)}, Valor entrada: R$ ${entryAmount.toFixed(2)}`);

        // Para pagamento com carteira, usar apenas o valor de entrada (sem taxa)
        if (user.balance < entryAmount) {
          return res.status(400).json({
            success: false,
            message: `Saldo insuficiente. Você tem R$ ${user.balance.toFixed(2)} e precisa de R$ ${entryAmount.toFixed(2)}`,
          });
        }

        // Usar transação do Prisma para garantir atomicidade
        const result = await prisma.$transaction(async (tx) => {
          // Buscar saldo atualizado dentro da transação
          const currentUser = await tx.user.findUnique({
            where: { id: userId },
            select: { balance: true },
          });

          if (!currentUser) {
            throw new Error("Usuário não encontrado");
          }

          console.log(`💰 [Wallet Payment - Transaction] Saldo antes: R$ ${currentUser.balance.toFixed(2)}, Valor a debitar: R$ ${entryAmount.toFixed(2)}`);

          if (currentUser.balance < entryAmount) {
            throw new Error(`Saldo insuficiente. Você tem R$ ${currentUser.balance.toFixed(2)} e precisa de R$ ${entryAmount.toFixed(2)}`);
          }

          // Verificar se já existe transação aprovada dentro da transação
          const existingTransaction = await tx.transaction.findFirst({
            where: {
              userId,
              challengeId,
              type: "challenge_entry",
              status: "approved",
            },
          });

          let transaction;
          if (existingTransaction) {
            // Se já existe transação, usar a existente
            transaction = existingTransaction;
            console.log(`📝 [Wallet Payment - Transaction] Usando transação existente: ID ${transaction.id}`);
          } else {
            // Se não existe, criar nova transação
            transaction = await tx.transaction.create({
              data: {
                userId,
                challengeId,
                type: "challenge_entry",
                amount: entryAmount,
                status: "approved",
                description: `Entrada no desafio: ${challenge.title}`,
              },
            });
            console.log(`📝 [Wallet Payment - Transaction] Transação criada: ID ${transaction.id}, Valor: R$ ${transaction.amount.toFixed(2)}, Status: ${transaction.status}`);
          }

          // Debitar da carteira apenas o valor de entrada (sem taxa)
          // Sempre debitar, mesmo se já existe transação (pode não ter sido debitado antes)
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: {
              balance: { decrement: entryAmount },
            },
            select: { balance: true },
          });

          console.log(`💰 [Wallet Payment - Transaction] Saldo depois: R$ ${updatedUser.balance.toFixed(2)}`);

          // Verificar se já está participando antes de criar
          const existingParticipant = await tx.challengeParticipant.findUnique({
            where: {
              userId_challengeId: {
                userId,
                challengeId,
              },
            },
          });

          if (!existingParticipant) {
            // Inscrever usuário no desafio
            const participant = await tx.challengeParticipant.create({
              data: {
                userId,
                challengeId,
                progress: 0,
                points: 0,
              },
            });
            console.log(`✅ [Wallet Payment - Transaction] Participante criado: ID ${participant.id}`);
          } else {
            console.log(`⚠️ [Wallet Payment - Transaction] Usuário já está participando do desafio`);
          }

          return transaction;
        });

        // Verificar saldo final após a transação
        const finalUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });

        console.log(`✅ [Wallet Payment] Pagamento processado com sucesso!`);
        console.log(`   Transação ID: ${result.id}`);
        console.log(`   Valor debitado: R$ ${entryAmount.toFixed(2)}`);
        console.log(`   Saldo final: R$ ${finalUser?.balance.toFixed(2) || 'N/A'}`);

        // Verificar se a transação foi realmente criada
        const verifyTransaction = await prisma.transaction.findUnique({
          where: { id: result.id },
        });

        if (!verifyTransaction) {
          console.error(`❌ [Wallet Payment] ERRO: Transação não foi criada! ID esperado: ${result.id}`);
          return res.status(500).json({
            success: false,
            message: "Erro ao processar pagamento. Transação não foi criada.",
          });
        }

        console.log(`✅ [Wallet Payment] Transação verificada: ID ${verifyTransaction.id}, Valor: R$ ${verifyTransaction.amount.toFixed(2)}, Status: ${verifyTransaction.status}`);

        return res.json({
          success: true,
          message: "Pagamento realizado com sucesso!",
          transactionId: result.id,
          amount: entryAmount,
          newBalance: finalUser?.balance,
        });
      }

      // ======================================================
      // 💳 PAGAMENTO COM PIX/CARTÃO (Mercado Pago)
      // ======================================================
      if (!mpAccessToken) {
        return res.status(500).json({
          success: false,
          message: "Configuração de pagamento indisponível",
        });
      }

      // Normalizar CPF (apenas números)
      const cpfDigits = String(payer?.cpf || "").replace(/\D/g, "");
      if (!cpfDigits || cpfDigits.length !== 11) {
        return res
          .status(400)
          .json({ success: false, message: "CPF inválido" });
      }

      const firstName = payer?.firstName || "Usuário";
      const lastName = payer?.lastName || "App";
      const email = payer?.email || "pagador@oki.com";

      // ======================================================
      // 🔵 PIX
      // ======================================================
      if (type === "pix") {
        const payment = await new Payment(mp).create({
          body: {
            transaction_amount: amountWithFee,
            payment_method_id: "pix",
            description: `Entrada no desafio: ${challenge.title}`,
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

        await prisma.transaction.create({
          data: {
            userId,
            challengeId,
            mpPaymentId: String(payment.id),
            status: "pending",
            type: "challenge_entry",
            amount: amountWithFee,
            description: `Entrada no desafio: ${challenge.title}`,
          },
        });

        return res.json({
          success: true,
          paymentId: payment.id,
          qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64:
            payment.point_of_interaction?.transaction_data?.qr_code_base64,
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

        // -------------------------------
        // 1) Criar TOKEN do cartão
        // -------------------------------
        const token = await new CardToken(mp).create({
          body: {
            card_number: cardNumber,
            expiration_month: String(expiration_month),
            expiration_year: String(expiration_year),
            security_code: card.cvv,
            cardholder: {
              name: `${firstName} ${lastName}`,
              identification: {
                type: "CPF",
                number: cpfDigits,
              },
            },
          } as any, // Type assertion necessário devido a incompatibilidade de tipos do SDK
        });

        // -------------------------------
        // 2) Criar PAGAMENTO cartão
        // -------------------------------
        const payment = await new Payment(mp).create({
          body: {
            transaction_amount: amountWithFee,
            token: token.id,
            description: `Entrada no desafio: ${challenge.title}`,
            installments: 1,
            payer: {
              email,
              first_name: firstName,
              last_name: lastName,
              identification: {
                type: "CPF",
                number: cpfDigits,
              },
            },
          },
        });

        // Salvar transação
        await prisma.transaction.create({
          data: {
            userId,
            challengeId,
            mpPaymentId: String(payment.id),
            status: payment.status,
            type: "challenge_entry",
            amount: amountWithFee,
            description: `Entrada no desafio: ${challenge.title}`,
          },
        });

        // Se aprovado, inscrever usuário no desafio
        if (payment.status === "approved") {
          await prisma.challengeParticipant.create({
            data: { userId, challengeId, progress: 0, points: 0 },
          });
        }

        return res.json({
          success: true,
          paymentId: payment.id,
          paymentStatus: payment.status,
          message:
            payment.status === "approved"
              ? "Pagamento aprovado!"
              : "Pagamento em processamento",
        });
      }

      return res
        .status(400)
        .json({ success: false, message: "Método de pagamento inválido" });
    } catch (err: any) {
      // 🔍 LOG MAIS DETALHADO PRO SEU CONSOLE
      console.error("❌ ERRO START PAYMENT:");
      if (err?.response) {
        console.error("Status MP:", err.response.status);
        console.error("Data MP:", err.response.data);
      } else {
        console.error(err);
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao iniciar pagamento",
      });
    }
  }

  // ======================================================
  // 🟩 CONFIRMAR PAGAMENTO DO PIX
  // ======================================================
  static async confirm(req: Request, res: Response) {
    try {
      const { paymentId } = req.body;

      if (!paymentId) {
        return res
          .status(400)
          .json({ success: false, message: "paymentId obrigatório" });
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
        where: { mpPaymentId: String(paymentId) },
      });

      if (!transaction) {
        return res
          .status(404)
          .json({ success: false, message: "Transação não encontrada" });
      }

      // Atualizar transação
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "approved" },
      });

      // Inscrever usuário no desafio
      if (!transaction.userId) {
        return res.status(400).json({
          success: false,
          message: "Transação sem usuário associado",
        });
      }

      await prisma.challengeParticipant.create({
        data: {
          userId: transaction.userId,
          challengeId: transaction.challengeId!,
          progress: 0,
          points: 0,
        },
      });

      return res.json({
        success: true,
        message: "Pagamento aprovado e usuário inscrito!",
      });
    } catch (err: any) {
      console.error("❌ ERRO CONFIRM PIX:", err?.response?.data || err);
      return res.status(500).json({
        success: false,
        message: "Erro ao confirmar pagamento",
      });
    }
  }
}
