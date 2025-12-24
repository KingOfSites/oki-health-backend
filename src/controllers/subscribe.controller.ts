import { Request, Response } from "express";
import prisma from "../config/database";
import { mpClient } from "../lib/mercadopago";
import { Payment, CardToken } from "mercadopago";

export class SubscribeController {

  // ------------------------------ CARTÃO ------------------------------
  static async subscribeWithCard(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      const {
        cardNumber,
        cardName,
        cardExpiry,
        cardCvv,
        cpf,
        planType,
        email,
        transaction_amount,
        installments,
        description,
      } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado.",
        });
      }

      if (!cardNumber || !cardName || !cardExpiry || !cardCvv || !cpf || !email || !planType) {
        return res.status(400).json({
          success: false,
          message: "Dados incompletos para pagamento.",
        });
      }

      const planName = planType === "annual" ? "Premium Anual" : "Premium Mensal";

      const plan = await prisma.plan.findFirst({
        where: { name: planName },
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Plano não encontrado.",
        });
      }

      // Normalizar dados do cartão
      const cardNumberClean = String(cardNumber).replace(/\D/g, "");
      console.log("🔍 Número do cartão recebido (limpo):", cardNumberClean, "Tamanho:", cardNumberClean.length);
      
      // Validar comprimento do cartão (13-19 dígitos)
      if (cardNumberClean.length < 13 || cardNumberClean.length > 19) {
        return res.status(400).json({
          success: false,
          message: `Número do cartão inválido. Deve ter entre 13 e 19 dígitos. Recebido: ${cardNumberClean.length} dígitos.`,
        });
      }
      
      // Validar BIN (primeiros 6 dígitos)
      const bin = cardNumberClean.substring(0, 6);
      if (bin.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Número do cartão muito curto. Verifique os dados.",
        });
      }
      
      console.log("🔍 BIN do cartão:", bin);

      const [monthStr, yearStr] = String(cardExpiry).split("/");
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
        return res.status(400).json({
          success: false,
          message: "Validade do cartão inválida.",
        });
      }

      const cpfDigits = String(cpf).replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return res.status(400).json({
          success: false,
          message: "CPF inválido.",
        });
      }

      // 1) Criar TOKEN do cartão
      let cardToken;
      try {
        cardToken = await new CardToken(mpClient).create({
          body: {
            card_number: cardNumberClean,
            expiration_month: String(expiration_month),
            expiration_year: String(expiration_year),
            security_code: String(cardCvv).replace(/\D/g, ""),
            cardholder: {
              name: cardName,
              identification: {
                type: "CPF",
                number: cpfDigits,
              },
            },
          } as any,
        });
      } catch (tokenError: any) {
        console.error("❌ Erro ao criar token do cartão:", tokenError);
        return res.status(400).json({
          success: false,
          message: "Erro ao processar dados do cartão. Verifique os dados e tente novamente.",
          details: tokenError.message || "Token inválido",
        });
      }

      // 2) Criar PAGAMENTO com o token
      const payment = new Payment(mpClient);
      const amount = transaction_amount || plan.price;

      let mpResponse: any;
      try {
        mpResponse = await payment.create({
          body: {
            token: cardToken.id,
            transaction_amount: amount,
            installments: installments || 1,
            description: description || `Assinatura ${planName}`,
            payer: {
              email,
              first_name: cardName.split(" ")[0] || cardName,
              identification: {
                type: "CPF",
                number: cpfDigits,
              },
            },
          },
        });
      } catch (paymentError: any) {
        console.error("❌ Erro ao criar pagamento no Mercado Pago:", paymentError);
        
        // Tratamento específico para erro de BIN não encontrado
        if (paymentError.message === "bin_not_found" || paymentError.error === "bad_request") {
          return res.status(400).json({
            success: false,
            message: "Número do cartão inválido ou não reconhecido. Verifique se está usando um cartão válido ou um cartão de teste do Mercado Pago.",
            details: "Para testes, use cartões de teste do Mercado Pago. Exemplo: 5031 4332 1540 6351",
          });
        }
        
        return res.status(400).json({
          success: false,
          message: paymentError.message || "Erro ao processar pagamento no Mercado Pago.",
          details: paymentError.cause || paymentError,
        });
      }

      if (!["approved", "pending", "in_process"].includes(mpResponse.status)) {
        return res.status(400).json({
          success: false,
          message: "Falha no pagamento.",
          error: mpResponse,
        });
      }

      // Desativa assinatura antiga
      await prisma.planSubscription.updateMany({
        where: { userId },
        data: { active: false },
      });

      const now = new Date();
      // Criar nova data sem modificar a original
      const endDate = new Date(now);
      if (planType === "annual") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      // Cria assinatura
      const subscription = await prisma.planSubscription.upsert({
        where: { userId },
        update: {
          planId: plan.id,
          active: true,
          startDate: new Date(),
          endDate,
        },
        create: {
          userId,
          planId: plan.id,
          active: true,
          startDate: new Date(),
          endDate,
        },
      });

      // Marcar usuário como PRO APENAS se o pagamento foi aprovado
      if (mpResponse.status === "approved") {
        await prisma.user.update({
          where: { id: userId },
          data: { isPro: true } as any
        });
        console.log("✅ Usuário marcado como PRO após pagamento aprovado:", userId);
      }

      // Registra transação no banco com dados do pagamento
      await prisma.transaction.create({
        data: {
          userId,
          amount: plan.price,
          type: "subscription",
          description: description || `Assinatura ${planName}`,
          mpPaymentId: String(mpResponse.id || ""),
          status: mpResponse.status || "pending",
        },
      });

      console.log("✅ Pagamento salvo no banco:", {
        userId,
        amount: plan.price,
        mpPaymentId: mpResponse.id,
        status: mpResponse.status,
      });

      return res.json({
        success: true,
        message: "Assinatura criada com sucesso!",
        subscription,
        payment: {
          id: mpResponse.id,
          status: mpResponse.status,
        },
      });

    } catch (error: any) {
      console.error("❌ ERRO GERAL EM ASSINATURA:", error);
      console.error("Stack:", error.stack);
      
      // Verificar se é erro de plano não encontrado
      if (error.message?.includes("plan") || error.message?.includes("Plano")) {
        return res.status(404).json({
          success: false,
          message: "Plano não encontrado. Execute o seed de planos primeiro.",
          details: error.message,
        });
      }
      
      return res.status(500).json({
        success: false,
        message: error.message || "Erro ao processar assinatura.",
        details: error.stack || error.message,
      });
    }
  }

  // ------------------------------ PIX ------------------------------
  static async subscribeWithPix(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { planType, cpf } = req.body;

      if (!userId || !planType || !cpf) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos para gerar PIX.",
        });
      }

      // Buscar dados do usuário
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado.",
        });
      }

      const planName = planType === "annual" ? "Premium Anual" : "Premium Mensal";

      const plan = await prisma.plan.findFirst({
        where: { name: planName },
      });

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Plano não encontrado.",
        });
      }

      const cpfDigits = String(cpf).replace(/\D/g, "");
      if (cpfDigits.length !== 11) {
        return res.status(400).json({
          success: false,
          message: "CPF inválido.",
        });
      }

      const payment = new Payment(mpClient);

      const mpPix: any = await payment.create({
        body: {
          transaction_amount: plan.price,
          description: `Assinatura ${planName}`,
          payment_method_id: "pix",
          payer: {
            email: user.email,
            first_name: user.name.split(" ")[0] || user.name,
            identification: {
              type: "CPF",
              number: cpfDigits,
            },
          },
        },
      });

      console.log("PIX RESPONSE:", mpPix);

      // Salvar transação PIX no banco (mesmo que ainda não esteja pago)
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount: plan.price,
          type: "subscription",
          description: `Assinatura ${planName} - PIX`,
          mpPaymentId: String(mpPix.id || ""),
          status: mpPix.status || "pending",
        },
      });

      console.log("✅ Pagamento PIX salvo no banco:", {
        transactionId: transaction.id,
        userId,
        amount: plan.price,
        mpPaymentId: mpPix.id,
        status: mpPix.status,
      });

      return res.json({
        success: true,
        qrCode: mpPix.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64:
          mpPix.point_of_interaction?.transaction_data?.qr_code_base64,
        expiration: mpPix.date_of_expiration,
        paymentId: mpPix.id,
        transactionId: transaction.id,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar PIX.",
        details: error.message,
      });
    }
  }

  // ------------------------------ VERIFICAR STATUS DO PAGAMENTO PIX ------------------------------
  static async checkPixPayment(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { paymentId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado.",
        });
      }

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: "ID do pagamento não informado.",
        });
      }

      // Buscar transação no banco
      const transaction = await prisma.transaction.findFirst({
        where: {
          mpPaymentId: paymentId,
          userId,
        },
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: "Pagamento não encontrado.",
        });
      }

      // Verificar status no Mercado Pago
      const payment = new Payment(mpClient);
      const mpPayment: any = await payment.get({ id: parseInt(paymentId) });

      // Atualizar status no banco se mudou
      if (transaction.status !== mpPayment.status) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: mpPayment.status },
        });

        // Se foi aprovado, criar/ativar assinatura
        if (mpPayment.status === "approved" && transaction.type === "subscription") {
          const plan = await prisma.plan.findFirst({
            where: { price: transaction.amount },
          });

          if (plan) {
            const now = new Date();
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + 1);

            await prisma.planSubscription.upsert({
              where: { userId },
              update: {
                planId: plan.id,
                active: true,
                startDate: new Date(),
                endDate,
              },
              create: {
                userId,
                planId: plan.id,
                active: true,
                startDate: new Date(),
                endDate,
              },
            });

            // Marcar usuário como PRO
            await prisma.user.update({
              where: { id: userId },
              data: { isPro: true } as any
            });
          }
        }
      }

      return res.json({
        success: true,
        payment: {
          id: mpPayment.id,
          status: mpPayment.status,
          transactionId: transaction.id,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Erro ao verificar pagamento.",
        details: error.message,
      });
    }
  }

  // ------------------------------ STATUS PREMIUM (MEU) ------------------------------
  static async getMyStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      if (!userId) {
        console.log("❌ getMyStatus: Usuário não autenticado");
        return res.status(401).json({
          success: false,
          premium: false,
          message: "Usuário não autenticado.",
        });
      }

      console.log("🔍 getMyStatus: Verificando status PRO para userId:", userId);
      
      // Buscar TODOS os dados do usuário para debug completo
      const userFull = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userFull) {
        console.log("❌ getMyStatus: Usuário não encontrado");
        return res.status(404).json({
          success: false,
          premium: false,
          message: "Usuário não encontrado.",
        });
      }

      console.log("🔍 getMyStatus: Usuário completo do banco:", {
        id: userFull.id,
        email: userFull.email,
        isPro: (userFull as any).isPro,
        isProType: typeof (userFull as any).isPro
      });

      // Buscar o usuário e verificar o campo isPro diretamente
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPro: true } as any
      });

      // Query SQL direta para garantir que estamos pegando o valor correto
      const rawQuery = await prisma.$queryRaw<Array<{ isPro: number }>>`
        SELECT isPro FROM users WHERE id = ${userId}
      `;
      
      console.log("🔍 getMyStatus: Query SQL direta resultado:", rawQuery);
      const rawIsPro = rawQuery[0]?.isPro;
      console.log("🔍 getMyStatus: isPro da query SQL direta:", rawIsPro, "Tipo:", typeof rawIsPro);

      // IMPORTANTE: Usar APENAS o campo isPro do banco (não considerar assinaturas antigas)
      // O campo isPro é a fonte única da verdade
      // Verificar explicitamente se isPro é true (1) ou false (0)
      // Usar o valor da query SQL direta se disponível, senão usar o Prisma
      const isProValue = rawIsPro !== undefined ? rawIsPro : (user as any).isPro;
      
      // Converter para boolean de forma explícita e segura
      // Aceita apenas: true, 1 como verdadeiro
      // Rejeita: false, 0, null, undefined como falso
      // IMPORTANTE: No MySQL, tinyint(1) retorna como número (0 ou 1), não boolean
      const isPremium = isProValue === true || isProValue === 1 || Number(isProValue) === 1;
      
      console.log("🔍 getMyStatus: ========== VERIFICAÇÃO DE STATUS PRO ==========");
      console.log("🔍 getMyStatus: userId:", userId);
      console.log("🔍 getMyStatus: isPro do banco (raw):", isProValue);
      console.log("🔍 getMyStatus: isPro do banco (tipo):", typeof isProValue);
      console.log("🔍 getMyStatus: isPro convertido para número:", Number(isProValue));
      console.log("🔍 getMyStatus: isPro === true:", isProValue === true);
      console.log("🔍 getMyStatus: isPro === 1:", isProValue === 1);
      console.log("🔍 getMyStatus: Number(isPro) === 1:", Number(isProValue) === 1);
      console.log("🔍 getMyStatus: isPro === false:", isProValue === false);
      console.log("🔍 getMyStatus: isPro === 0:", isProValue === 0);
      console.log("✅ getMyStatus: Premium status final:", isPremium);
      console.log("🔍 getMyStatus: ==============================================");

      // Buscar informações da assinatura apenas para retornar no response (se existir)
      const subscription = await prisma.planSubscription.findFirst({
        where: {
          userId,
          active: true,
          endDate: { 
            not: null,
            gte: new Date()
          }
        },
        include: { plan: true },
        orderBy: { endDate: 'desc' }
      });

      return res.json({
        success: true,
        premium: isPremium,
        plan: subscription?.plan?.name ?? null,
        expiresAt: subscription?.endDate ?? null
      });

    } catch (error: any) {
      console.error("❌ ERRO AO VERIFICAR STATUS PREMIUM:", error);
      return res.status(500).json({
        success: false,
        premium: false,
        message: "Erro ao verificar assinatura.",
        error: error.message
      });
    }
  }

  // ------------------------------ STATUS PREMIUM ------------------------------
  static async getStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const subscription = await prisma.planSubscription.findFirst({
        where: {
          userId,
          active: true,
          endDate: { gte: new Date() }
        },
        include: { plan: true }
      });

      return res.json({
        premium: Boolean(subscription),
        plan: subscription?.plan?.name ?? null,
        expiresAt: subscription?.endDate ?? null
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Erro ao verificar assinatura."
      });
    }
  }
}
