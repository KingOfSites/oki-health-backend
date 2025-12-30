# 🔧 Troubleshooting - Pagamentos Rejeitados no Mercado Pago

## ❌ Por que o pagamento foi rejeitado?

### 1. **Cartões de Teste - Uso Correto**

O Mercado Pago tem cartões de teste específicos que funcionam apenas em ambiente de **teste** (sandbox):

#### ✅ Cartões de Teste que APROVAM:
- **Número**: `5031 4332 1540 6351`
- **CVV**: `123`
- **Validade**: Qualquer data futura (ex: `12/25`)
- **Nome**: Qualquer nome
- **CPF**: `12345678909` (ou qualquer CPF válido)

#### ❌ Cartões de Teste que REJEITAM:
- **Número**: `5031 4332 1540 6352`
- **CVV**: `123`
- **Validade**: Qualquer data futura
- **Nome**: Qualquer nome
- **CPF**: `12345678909`

### 2. **Ambiente de Teste vs Produção**

⚠️ **IMPORTANTE**: Se você está usando um **Access Token de PRODUÇÃO**, os cartões de teste **NÃO FUNCIONAM**!

- **Sandbox (Teste)**: Use cartões de teste + Access Token de teste
- **Produção**: Use cartões reais + Access Token de produção

### 3. **Motivos Comuns de Rejeição**

#### a) **Cartão Inválido**
```
Status: "rejected"
Status Detail: "cc_rejected_bad_filled_security_code"
```
**Solução**: Verifique se o CVV está correto (3 ou 4 dígitos)

#### b) **Cartão Expirado**
```
Status: "rejected"
Status Detail: "cc_rejected_expired"
```
**Solução**: Use uma data de validade futura

#### c) **Saldo Insuficiente (Cartão de Teste)**
```
Status: "rejected"
Status Detail: "cc_rejected_insufficient_amount"
```
**Solução**: Use o cartão de teste correto que aprova

#### d) **Token Inválido**
```
Status: "rejected"
Status Detail: "cc_rejected_bad_filled_card_number"
```
**Solução**: Verifique se o número do cartão está correto

#### e) **CPF Inválido**
```
Status: "rejected"
Status Detail: "cc_rejected_bad_filled_other"
```
**Solução**: Use um CPF válido (11 dígitos)

### 4. **Como Verificar o Motivo da Rejeição**

O código agora loga detalhes completos no console do backend:

```typescript
// Backend loga automaticamente:
console.error("❌ [Wallet Payment] Pagamento rejeitado:", {
  paymentId: payment.id,
  status: payment.status,
  statusDetail: payment.status_detail,  // ← Motivo específico
  cause: payment.cause,                  // ← Detalhes adicionais
  rejectionReason,
});
```

### 5. **Status Possíveis do Mercado Pago**

- ✅ **`approved`**: Pagamento aprovado
- ❌ **`rejected`**: Pagamento rejeitado
- ⏳ **`pending`**: Pagamento pendente (aguardando confirmação)
- ⏳ **`in_process`**: Pagamento em processamento
- ⏳ **`authorized`**: Pagamento autorizado (aguardando captura)

### 6. **Como Testar Corretamente**

#### Passo 1: Verificar o Access Token
```bash
# No arquivo .env do backend
MP_ACCESS_TOKEN=TEST-xxxxx-xxxxx  # ← Deve começar com "TEST-" para sandbox
```

#### Passo 2: Usar Cartão de Teste Correto
```
Número: 5031 4332 1540 6351
CVV: 123
Validade: 12/25 (qualquer data futura)
Nome: Teste Usuario
CPF: 12345678909
Email: teste@teste.com
```

#### Passo 3: Verificar Logs do Backend
```bash
# Procure por:
💳 [Wallet Payment] Status do pagamento: approved/rejected
❌ [Wallet Payment] Pagamento rejeitado: { detalhes }
```

### 7. **Solução Rápida**

Se o pagamento está sendo rejeitado:

1. ✅ Verifique se está usando Access Token de **TESTE** (começa com `TEST-`)
2. ✅ Use o cartão de teste correto: `5031 4332 1540 6351`
3. ✅ Verifique os logs do backend para ver o motivo específico
4. ✅ Certifique-se de que todos os campos estão preenchidos corretamente

### 8. **Documentação Oficial**

- [Cartões de Teste do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/testing)
- [Status de Pagamentos](https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get)

