# 🔄 Como funciona a integração com Mercado Pago

## 📋 Visão Geral

A integração com o Mercado Pago é feita através da **SDK oficial** (`mercadopago`) instalada no backend. O fluxo funciona da seguinte forma:

## 🔧 Configuração

### 1. Instalação da SDK
```json
// package.json
"mercadopago": "^2.11.0"
```

### 2. Configuração do Access Token
O backend lê o token de acesso do Mercado Pago através de variáveis de ambiente:

```typescript
// oki-health-backend/src/controllers/wallet.controller.ts (linhas 9-14)
const mpAccessToken =
  process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;

const mp = new MercadoPagoConfig({
  accessToken: mpAccessToken || "",
});
```

**⚠️ IMPORTANTE:** Você precisa configurar a variável de ambiente no arquivo `.env`:
```env
MP_ACCESS_TOKEN=seu-token-aqui
# ou
MERCADOPAGO_ACCESS_TOKEN=seu-token-aqui
```

## 🔄 Fluxo Completo de Pagamento

### **CENÁRIO 1: Pagamento com Cartão de Crédito**

```
┌─────────────┐
│   FRONTEND  │
│ (React Native)
└──────┬──────┘
       │ 1. Usuário preenche dados do cartão
       │ 2. Chama: walletService.startDepositPayment()
       │
       ▼
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  POST /api/wallet/deposit/payment   │
└──────┬──────────────────────────────┘
       │
       │ 3. Valida dados do cartão
       │ 4. Cria TOKEN do cartão via Mercado Pago
       │
       ▼
┌─────────────────────────────────────┐
│      MERCADO PAGO API               │
│  POST /v1/card_tokens               │
│  (Tokeniza o cartão - segurança)    │
└──────┬──────────────────────────────┘
       │
       │ 5. Retorna token seguro
       │
       ▼
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  Cria pagamento com o token         │
└──────┬──────────────────────────────┘
       │
       │ 6. Chama API do Mercado Pago para criar pagamento
       │
       ▼
┌─────────────────────────────────────┐
│      MERCADO PAGO API               │
│  POST /v1/payments                  │
│  (Processa o pagamento real)        │
└──────┬──────────────────────────────┘
       │
       │ 7. Retorna status: "approved", "pending", "rejected"
       │
       ▼
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  - Salva transação no banco         │
│  - Se aprovado: credita na carteira │
└──────┬──────────────────────────────┘
       │
       │ 8. Retorna resposta para frontend
       │
       ▼
┌─────────────┐
│   FRONTEND  │
│ Mostra sucesso/erro
└─────────────┘
```

**Código relevante:**
```typescript
// oki-health-backend/src/controllers/wallet.controller.ts (linhas 322-356)

// 1. Criar TOKEN do cartão (tokenização - segurança)
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

// 2. Criar PAGAMENTO usando o token (não o cartão diretamente)
const payment = await new Payment(mp).create({
  body: {
    transaction_amount: amount,
    token: token.id,  // ← Usa o token, não os dados do cartão
    description: `Depósito na carteira - R$ ${amount.toFixed(2)}`,
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

// 3. Verificar status e creditar se aprovado
if (payment.status === "approved") {
  await prisma.user.update({
    where: { id: userId },
    data: {
      balance: { increment: amount },
      total_earned: { increment: amount },
    },
  });
}
```

---

### **CENÁRIO 2: Pagamento com PIX**

```
┌─────────────┐
│   FRONTEND  │
│ (React Native)
└──────┬──────┘
       │ 1. Usuário informa CPF
       │ 2. Chama: walletService.startDepositPayment()
       │
       ▼
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  POST /api/wallet/deposit/payment   │
└──────┬──────────────────────────────┘
       │
       │ 3. Valida CPF
       │ 4. Cria pagamento PIX via Mercado Pago
       │
       ▼
┌─────────────────────────────────────┐
│      MERCADO PAGO API               │
│  POST /v1/payments                  │
│  payment_method_id: "pix"            │
└──────┬──────────────────────────────┘
       │
       │ 5. Retorna QR Code e código PIX
       │
       ▼
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  - Salva transação como "pending"    │
│  - Retorna QR Code para frontend    │
└──────┬──────────────────────────────┘
       │
       │ 6. Frontend exibe QR Code
       │
       ▼
┌─────────────┐
│   FRONTEND  │
│ Mostra QR Code
│ Verifica status a cada 5 segundos
└──────┬──────┘
       │
       │ 7. Polling: walletService.confirmDepositPayment()
       │
       ▼
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  POST /api/wallet/deposit/confirm   │
└──────┬──────────────────────────────┘
       │
       │ 8. Consulta status no Mercado Pago
       │
       ▼
┌─────────────────────────────────────┐
│      MERCADO PAGO API               │
│  GET /v1/payments/{paymentId}       │
└──────┬──────────────────────────────┘
       │
       │ 9. Retorna status do pagamento
       │
       ▼
┌─────────────────────────────────────┐
│         BACKEND API                 │
│  Se status === "approved":          │
│  - Atualiza transação para "completed"
│  - Credita valor na carteira        │
└──────┬──────────────────────────────┘
       │
       │ 10. Retorna sucesso
       │
       ▼
┌─────────────┐
│   FRONTEND  │
│ Mostra confirmação
│ Redireciona para carteira
└─────────────┘
```

**Código relevante:**
```typescript
// oki-health-backend/src/controllers/wallet.controller.ts (linhas 239-278)

// 1. Criar pagamento PIX
const payment = await new Payment(mp).create({
  body: {
    transaction_amount: amount,
    payment_method_id: "pix",  // ← Define como PIX
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

// 2. Retornar QR Code
return res.json({
  success: true,
  data: {
    paymentId: payment.id,
    qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
    qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
  },
});

// 3. Confirmar pagamento (quando usuário paga)
const payment = await new Payment(mp).get({ id: paymentId });

if (payment.status === "approved") {
  // Creditar na carteira
  await prisma.user.update({
    where: { id: userId },
    data: {
      balance: { increment: transaction.amount },
      total_earned: { increment: transaction.amount },
    },
  });
}
```

## 🔐 Segurança

1. **Tokenização de Cartão**: Os dados do cartão nunca são armazenados. O Mercado Pago retorna um token seguro que é usado para criar o pagamento.

2. **Access Token**: O token de acesso do Mercado Pago fica apenas no backend (variável de ambiente), nunca exposto no frontend.

3. **HTTPS**: Todas as comunicações são feitas via HTTPS.

## 📝 Endpoints Utilizados

### Frontend → Backend
- `POST /api/wallet/deposit/payment` - Iniciar pagamento
- `POST /api/wallet/deposit/confirm` - Confirmar PIX

### Backend → Mercado Pago
- `POST /v1/card_tokens` - Tokenizar cartão
- `POST /v1/payments` - Criar pagamento
- `GET /v1/payments/{id}` - Consultar status

## 🧪 Testes

Para testar em ambiente de desenvolvimento, use os cartões de teste do Mercado Pago:
- **Aprovado**: 5031 4332 1540 6351
- **Rejeitado**: 5031 4332 1540 6352

## 📚 Documentação Oficial

- [SDK Mercado Pago Node.js](https://www.mercadopago.com.br/developers/pt/docs/sdks-library/client-side/sdk-nodejs)
- [API de Pagamentos](https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post)

