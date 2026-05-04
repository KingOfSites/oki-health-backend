import { Request, Response } from "express";
import prisma from "../config/database";
import { mpClient } from "../lib/mercadopago";
import { Payment, CardToken } from "mercadopago";
import { AffiliateService } from "../services/affiliate.service";

// Helper: dispara cálculo de comissão de afiliado sem quebrar o fluxo principal.
async function commissionAfterSubscription(
  userId: string,
  amount: number,
): Promise<void> {
  try {
    await AffiliateService.calculateCommissionForPayment(
      userId,
      amount,
      "subscription",
    );
  } catch (err) {
    console.error("[Affiliate] Erro ao calcular comissão de assinatura:", err);
  }
}

export class SubscribeController {
  // Resolve plano por id, nome ou planType (compatibilidade).
  // Retorna null se nenhum dado válido foi enviado.
  static async resolvePlan(body: {
    planId?: string;
    planName?: string;
    planType?: "monthly" | "annual";
  }) {
    if (body.planId) {
      return prisma.plan.findUnique({ where: { id: body.planId } });
    }
    if (body.planName) {
      return prisma.plan.findFirst({ where: { name: body.planName } });
    }
    if (body.planType) {
      const fallbackName =
        body.planType === "annual" ? "Premium Anual" : "Premium Mensal";
      return prisma.plan.findFirst({ where: { name: fallbackName } });
    }
    return null;
  }

  // ------------------------------ LISTAR PLANOS ------------------------------
  static async listPlans(_req: Request, res: Response) {
    try {
      const plans = await prisma.plan.findMany({
        orderBy: { price: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          benefits: true,
        },
      });

      return res.status(200).json({
        success: true,
        data: plans,
      });
    } catch (error: any) {
      console.error("Erro ao listar planos:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar planos.",
        error: error?.message,
      });
    }
  }

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

      if (
        !cardNumber ||
        !cardName ||
        !cardExpiry ||
        !cardCvv ||
        !cpf ||
        !email ||
        !planType
      ) {
        return res.status(400).json({
          success: false,
          message: "Dados incompletos para pagamento.",
        });
      }

      const plan = await SubscribeController.resolvePlan(req.body);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Plano não encontrado.",
        });
      }

      // Normalizar dados do cartão
      const cardNumberClean = String(cardNumber).replace(/\D/g, "");
      console.log(
        "🔍 Número do cartão recebido (limpo):",
        cardNumberClean,
        "Tamanho:",
        cardNumberClean.length
      );

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
          message:
            "Erro ao processar dados do cartão. Verifique os dados e tente novamente.",
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
            description: description || `Assinatura ${plan.name}`,
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
        console.error(
          "❌ Erro ao criar pagamento no Mercado Pago:",
          paymentError
        );

        // Tratamento específico para erro de BIN não encontrado
        if (
          paymentError.message === "bin_not_found" ||
          paymentError.error === "bad_request"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Número do cartão inválido ou não reconhecido. Verifique se está usando um cartão válido ou um cartão de teste do Mercado Pago.",
            details:
              "Para testes, use cartões de teste do Mercado Pago. Exemplo: 5031 4332 1540 6351",
          });
        }

        // PolicyAgent / 403: pagador == dono da conta MP, conta em análise, etc.
        const isPolicyError =
          paymentError?.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" ||
          paymentError?.blocked_by === "PolicyAgent" ||
          paymentError?.cause?.[0]?.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" ||
          paymentError?.status === 403 ||
          /policy.*UNAUTHORIZED/i.test(paymentError?.message || "");

        if (isPolicyError) {
          return res.status(400).json({
            success: false,
            message:
              "O Mercado Pago bloqueou esta transação (PolicyAgent). Possíveis causas: o pagador é o próprio dono da conta coletora, a conta MP está em análise/KYC pendente, ou o cartão usado pertence ao mesmo titular da conta MP. Tente com outro usuário/cartão.",
            errorCode: "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
          });
        }

        return res.status(400).json({
          success: false,
          message:
            paymentError.message ||
            "Erro ao processar pagamento no Mercado Pago.",
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
          data: { isPro: true } as any,
        });
        console.log(
          "✅ Usuário marcado como PRO após pagamento aprovado:",
          userId
        );
        await commissionAfterSubscription(userId, plan.price);
      }

      // Registra transação no banco com dados do pagamento
      await prisma.transaction.create({
        data: {
          userId,
          amount: plan.price,
          type: "subscription",
          description: description || `Assinatura ${plan.name}`,
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

  // ------------------------------ GOOGLE PAY ------------------------------
  static async subscribeWithGooglePay(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { planType, cpf, email, googlePayToken, description } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Usuário não autenticado." });
      }

      if (!googlePayToken || !planType || !cpf || !email) {
        return res.status(400).json({ success: false, message: "Dados incompletos para pagamento." });
      }

      const plan = await SubscribeController.resolvePlan(req.body);

      if (!plan) {
        return res.status(404).json({ success: false, message: "Plano não encontrado." });
      }

      const cpfDigits = String(cpf).replace(/\D/g, "");
      
      const tokenData = typeof googlePayToken === "string" ? JSON.parse(googlePayToken) : googlePayToken;
      let mpToken = "";
      if (typeof tokenData === "string") {
        mpToken = tokenData;
      } else if (tokenData.id) {
        mpToken = tokenData.id;
      } else if (tokenData.signature) {
        mpToken = tokenData.signature;
      } else if (tokenData.paymentMethodData?.tokenizationData?.token) {
        try {
          const innerToken = JSON.parse(tokenData.paymentMethodData.tokenizationData.token);
          mpToken = innerToken.id || innerToken;
        } catch (e) {
          mpToken = tokenData.paymentMethodData.tokenizationData.token;
        }
      } else {
        mpToken = JSON.stringify(tokenData);
      }

      const payment = new Payment(mpClient);
      let mpResponse: any;

      try {
        mpResponse = await payment.create({
          body: {
            token: mpToken,
            transaction_amount: plan.price,
            payment_method_id: "google_pay",
            installments: 1,
            description: description || `Assinatura ${plan.name} via Google Pay`,
            payer: {
              email,
              identification: { type: "CPF", number: cpfDigits },
            },
          } as any,
        });
      } catch (paymentError: any) {
        console.error("❌ Erro ao criar pagamento MP (Google Pay):", paymentError);
        return res.status(400).json({
          success: false,
          message: "Erro ao processar pagamento com Google Pay. Tente usar um cartão.",
          details: paymentError.cause || paymentError.message,
        });
      }

      if (!["approved", "pending", "in_process"].includes(mpResponse.status)) {
        return res.status(400).json({ success: false, message: "Falha no pagamento (Google Pay).", error: mpResponse });
      }

      await prisma.planSubscription.updateMany({ where: { userId }, data: { active: false } });

      const now = new Date();
      const endDate = new Date(now);
      if (planType === "annual") endDate.setFullYear(endDate.getFullYear() + 1);
      else endDate.setMonth(endDate.getMonth() + 1);

      const subscription = await prisma.planSubscription.upsert({
        where: { userId },
        update: { planId: plan.id, active: true, startDate: new Date(), endDate },
        create: { userId, planId: plan.id, active: true, startDate: new Date(), endDate },
      });

      if (mpResponse.status === "approved") {
        await prisma.user.update({ where: { id: userId }, data: { isPro: true } as any });
        await commissionAfterSubscription(userId, plan.price);
      }

      await prisma.transaction.create({
        data: {
          userId,
          amount: plan.price,
          type: "subscription",
          description: description || `Assinatura ${plan.name} via Google Pay`,
          mpPaymentId: String(mpResponse.id || ""),
          status: mpResponse.status || "pending",
        },
      });

      return res.json({
        success: true,
        message: "Assinatura via Google Pay iniciada com sucesso!",
        subscription,
        payment: { id: mpResponse.id, status: mpResponse.status },
      });
    } catch (error: any) {
      console.error("❌ ERRO GOOGLE PAY:", error);
      return res.status(500).json({ success: false, message: error.message || "Erro." });
    }
  }

  // ------------------------------ APPLE PAY ------------------------------
  static async subscribeWithApplePay(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { planType, cpf, email, applePayToken, description } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Usuário não autenticado." });
      }

      if (!applePayToken || !planType || !cpf || !email) {
        return res.status(400).json({ success: false, message: "Dados incompletos para pagamento." });
      }

      const plan = await SubscribeController.resolvePlan(req.body);

      if (!plan) {
        return res.status(404).json({ success: false, message: "Plano não encontrado." });
      }

      const cpfDigits = String(cpf).replace(/\D/g, "");
      
      const tokenData = typeof applePayToken === "string" ? JSON.parse(applePayToken) : applePayToken;
      const mpToken = tokenData?.paymentData ?? tokenData;

      const payment = new Payment(mpClient);
      let mpResponse: any;

      try {
        mpResponse = await payment.create({
          body: {
            token: typeof mpToken === "string" ? mpToken : JSON.stringify(mpToken),
            transaction_amount: plan.price,
            payment_method_id: "apple_pay",
            installments: 1,
            description: description || `Assinatura ${plan.name} via Apple Pay`,
            payer: {
              email,
              identification: { type: "CPF", number: cpfDigits },
            },
          } as any,
        });
      } catch (paymentError: any) {
        console.error("❌ Erro ao criar pagamento MP (Apple Pay):", paymentError);
        return res.status(400).json({
          success: false,
          message: "Erro ao processar pagamento com Apple Pay. Tente usar um cartão.",
          details: paymentError.cause || paymentError.message,
        });
      }

      if (!["approved", "pending", "in_process"].includes(mpResponse.status)) {
        return res.status(400).json({ success: false, message: "Falha no pagamento (Apple Pay).", error: mpResponse });
      }

      await prisma.planSubscription.updateMany({ where: { userId }, data: { active: false } });

      const now = new Date();
      const endDate = new Date(now);
      if (planType === "annual") endDate.setFullYear(endDate.getFullYear() + 1);
      else endDate.setMonth(endDate.getMonth() + 1);

      const subscription = await prisma.planSubscription.upsert({
        where: { userId },
        update: { planId: plan.id, active: true, startDate: new Date(), endDate },
        create: { userId, planId: plan.id, active: true, startDate: new Date(), endDate },
      });

      if (mpResponse.status === "approved") {
        await prisma.user.update({ where: { id: userId }, data: { isPro: true } as any });
        await commissionAfterSubscription(userId, plan.price);
      }

      await prisma.transaction.create({
        data: {
          userId,
          amount: plan.price,
          type: "subscription",
          description: description || `Assinatura ${plan.name} via Apple Pay`,
          mpPaymentId: String(mpResponse.id || ""),
          status: mpResponse.status || "pending",
        },
      });

      return res.json({
        success: true,
        message: "Assinatura via Apple Pay iniciada com sucesso!",
        subscription,
        payment: { id: mpResponse.id, status: mpResponse.status },
      });
    } catch (error: any) {
      console.error("❌ ERRO APPLE PAY:", error);
      return res.status(500).json({ success: false, message: error.message || "Erro." });
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

      const plan = await SubscribeController.resolvePlan(req.body);

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
          description: `Assinatura ${plan.name}`,
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

      console.log("🔍 PIX RESPONSE COMPLETA:", JSON.stringify(mpPix, null, 2));
      console.log("🔍 PIX point_of_interaction:", mpPix.point_of_interaction);
      console.log(
        "🔍 PIX transaction_data:",
        mpPix.point_of_interaction?.transaction_data
      );
      console.log(
        "🔍 PIX qr_code:",
        mpPix.point_of_interaction?.transaction_data?.qr_code
      );
      console.log(
        "🔍 PIX qr_code_base64:",
        mpPix.point_of_interaction?.transaction_data?.qr_code_base64
      );

      // Salvar transação PIX no banco (mesmo que ainda não esteja pago)
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount: plan.price,
          type: "subscription",
          description: `Assinatura ${plan.name} - PIX`,
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

      // Extrair dados do QR Code PIX
      const qrCode = mpPix.point_of_interaction?.transaction_data?.qr_code;
      const qrCodeBase64 =
        mpPix.point_of_interaction?.transaction_data?.qr_code_base64;
      const expiration = mpPix.date_of_expiration;
      const paymentId = mpPix.id;

      console.log("✅ Dados extraídos do PIX:");
      console.log("  - qrCode:", qrCode ? "✅ Presente" : "❌ Ausente");
      console.log(
        "  - qrCodeBase64:",
        qrCodeBase64 ? "✅ Presente" : "❌ Ausente"
      );
      console.log("  - expiration:", expiration);
      console.log("  - paymentId:", paymentId);

      const responseData = {
        success: true,
        qrCode: qrCode || null,
        qrCodeBase64: qrCodeBase64 || null,
        expiration: expiration || null,
        paymentId: paymentId || null,
        transactionId: transaction.id,
      };

      console.log("📤 Enviando resposta PIX:", responseData);

      return res.json(responseData);
    } catch (error: any) {
      console.error("❌ ============ ERRO PIX ASSINATURA ============");
      console.error("❌ Mensagem:", error?.message);
      console.error("❌ Nome do erro:", error?.name);
      console.error("❌ Status MP:", error?.status);
      console.error("❌ Stack:", error?.stack);
      if (error?.cause) console.error("❌ Cause:", JSON.stringify(error.cause, null, 2));
      if (error?.error) console.error("❌ MP error body:", JSON.stringify(error.error, null, 2));
      if (error?.response) console.error("❌ MP response:", JSON.stringify(error.response, null, 2));
      console.error("❌ ==============================================");

      // PolicyAgent / 403: comprador == dono da conta MP, PIX não habilitado
      // ou conta em análise. Retornamos 400 com mensagem clara em vez de 500.
      const isPolicyError =
        error?.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" ||
        error?.blocked_by === "PolicyAgent" ||
        error?.cause?.[0]?.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" ||
        error?.status === 403 ||
        /policy.*UNAUTHORIZED/i.test(error?.message || "");

      if (isPolicyError) {
        return res.status(400).json({
          success: false,
          message:
            "O Mercado Pago bloqueou esta transação. Verifique se a conta tem PIX habilitado e se o pagador é diferente do dono da conta coletora.",
          errorCode: "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao gerar PIX.",
        details: error.message,
        mpError: error?.cause ?? error?.error ?? null,
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
        if (
          mpPayment.status === "approved" &&
          transaction.type === "subscription"
        ) {
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
              data: { isPro: true } as any,
            });

            // Creditar comissão de afiliado (idempotente)
            await commissionAfterSubscription(userId, plan.price);
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

      console.log(
        "🔍 getMyStatus: Verificando status PRO para userId:",
        userId
      );

      // Buscar apenas os campos necessários para evitar referências circulares
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          isPro: true,
        },
      });

      if (!user) {
        console.log("❌ getMyStatus: Usuário não encontrado");
        return res.status(404).json({
          success: false,
          premium: false,
          message: "Usuário não encontrado.",
        });
      }

      console.log("🔍 getMyStatus: Usuário do banco:", {
        id: user.id,
        email: user.email,
        isPro: user.isPro,
        isProType: typeof user.isPro,
      });

      // Query SQL direta para garantir que estamos pegando o valor correto
      const rawQuery = await prisma.$queryRaw<Array<{ isPro: number }>>`
        SELECT isPro FROM users WHERE id = ${userId}
      `;

      console.log("🔍 getMyStatus: Query SQL direta resultado:", rawQuery);
      const rawIsPro = rawQuery[0]?.isPro;
      console.log(
        "🔍 getMyStatus: isPro da query SQL direta:",
        rawIsPro,
        "Tipo:",
        typeof rawIsPro
      );

      // IMPORTANTE: Usar APENAS o campo isPro do banco (não considerar assinaturas antigas)
      // O campo isPro é a fonte única da verdade
      // Verificar explicitamente se isPro é true (1) ou false (0)
      // Usar o valor da query SQL direta se disponível, senão usar o Prisma
      const isProValue =
        rawIsPro !== undefined ? rawIsPro : user.isPro;

      // Converter para boolean de forma explícita e segura
      // Aceita apenas: true, 1 como verdadeiro
      // Rejeita: false, 0, null, undefined como falso
      // IMPORTANTE: No MySQL, tinyint(1) retorna como número (0 ou 1), não boolean
      const isPremium =
        isProValue === true || isProValue === 1 || Number(isProValue) === 1;

      console.log(
        "🔍 getMyStatus: ========== VERIFICAÇÃO DE STATUS PRO =========="
      );
      console.log("🔍 getMyStatus: userId:", userId);
      console.log("🔍 getMyStatus: isPro do banco (raw):", isProValue);
      console.log("🔍 getMyStatus: isPro do banco (tipo):", typeof isProValue);
      console.log(
        "🔍 getMyStatus: isPro convertido para número:",
        Number(isProValue)
      );
      console.log("🔍 getMyStatus: isPro === true:", isProValue === true);
      console.log("🔍 getMyStatus: isPro === 1:", isProValue === 1);
      console.log(
        "🔍 getMyStatus: Number(isPro) === 1:",
        Number(isProValue) === 1
      );
      console.log("🔍 getMyStatus: isPro === false:", isProValue === false);
      console.log("🔍 getMyStatus: isPro === 0:", isProValue === 0);
      console.log("✅ getMyStatus: Premium status final:", isPremium);
      console.log(
        "🔍 getMyStatus: =============================================="
      );

      // Buscar informações da assinatura apenas para retornar no response (se existir)
      const subscription = await prisma.planSubscription.findFirst({
        where: {
          userId,
          active: true,
          endDate: {
            not: null,
            gte: new Date(),
          },
        },
        select: {
          id: true,
          endDate: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { endDate: "desc" },
      });

      return res.json({
        success: true,
        premium: isPremium || Boolean(subscription),
        plan: subscription?.plan?.name ?? null,
        expiresAt: subscription?.endDate ?? null,
      });
    } catch (error: any) {
      console.error("❌ ERRO AO VERIFICAR STATUS PREMIUM:", error);
      return res.status(500).json({
        success: false,
        premium: false,
        message: "Erro ao verificar assinatura.",
        error: error.message,
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
          endDate: { gte: new Date() },
        },
        select: {
          id: true,
          endDate: true,
          plan: {
            select: {
              name: true,
            },
          },
        },
      });

      return res.json({
        premium: Boolean(subscription),
        plan: subscription?.plan?.name ?? null,
        expiresAt: subscription?.endDate ?? null,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Erro ao verificar assinatura.",
      });
    }
  }
}
