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
      const fee = 1500; // taxa fixa (em centavos)
      const amount = (entry + fee) / 100; // valor em R$

      // ======================================================
      // 🔒 VERIFICAR SE JÁ EXISTE PAGAMENTO APROVADO
      // ======================================================
      const alreadyPaid = await prisma.transaction.findFirst({
        where: {
          userId,
          challengeId,
          type: "challenge_entry",
          status: "approved",
        },
      });

      if (alreadyPaid) {
        return res.json({
          success: true,
          message: "Pagamento já realizado anteriormente",
        });
      }

      // ======================================================
      // 💰 PAGAMENTO COM CARTEIRA
      // ======================================================
      if (type === "wallet") {
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

        if (user.balance < amount) {
          return res.status(400).json({
            success: false,
            message: `Saldo insuficiente. Você tem R$ ${user.balance.toFixed(2)} e precisa de R$ ${amount.toFixed(2)}`,
          });
        }

        // Debitar da carteira
        await prisma.user.update({
          where: { id: userId },
          data: {
            balance: { decrement: amount },
          },
        });

        // Criar transação
        const transaction = await prisma.transaction.create({
          data: {
            userId,
            challengeId,
            type: "challenge_entry",
            amount,
            status: "approved",
            description: `Entrada no desafio: ${challenge.title}`,
          },
        });

        // Inscrever usuário no desafio
        await prisma.challengeParticipant.create({
          data: {
            userId,
            challengeId,
            progress: 0,
            points: 0,
          },
        });

        return res.json({
          success: true,
          message: "Pagamento realizado com sucesso!",
          transactionId: transaction.id,
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
            transaction_amount: amount,
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
            amount,
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

        // -------------------------------
        // 2) Criar PAGAMENTO cartão
        // -------------------------------
        const payment = await new Payment(mp).create({
          body: {
            transaction_amount: amount,
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
            amount,
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
