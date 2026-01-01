# 🔔 Configuração de Webhooks do Mercado Pago

## 📋 Visão Geral

O sistema agora usa **webhooks** do Mercado Pago para receber notificações automáticas quando um pagamento é aprovado ou rejeitado. Isso elimina a necessidade de polling (verificação periódica) no frontend.

## 🔄 Como Funciona

### Fluxo com Webhook:

```
1. Usuário inicia pagamento (PIX ou Cartão)
   ↓
2. Backend cria pagamento no Mercado Pago
   ↓
3. Transação é salva como "pending" no banco
   ↓
4. Usuário paga (PIX) ou cartão é processado
   ↓
5. Mercado Pago envia webhook para o backend
   ↓
6. Backend processa webhook automaticamente:
   - Se aprovado: credita na carteira
   - Se rejeitado: atualiza status
   ↓
7. Frontend pode verificar status (opcional)
```

## 🛠️ Configuração no Mercado Pago

### 1. Acessar Configurações de Webhooks

1. Acesse o [Painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
2. Vá em **"Suas integrações"** → **"Webhooks"**
3. Clique em **"Criar webhook"**

### 2. Configurar URL do Webhook

**URL do Webhook:**
```
https://seu-dominio.com/api/wallet/webhook
```

**Para desenvolvimento local (usando ngrok ou similar):**
```
https://seu-ngrok-url.ngrok.io/api/wallet/webhook
```

### 3. Eventos a Escutar

Selecione os seguintes eventos:
- ✅ **payment** (Pagamentos)

### 4. Salvar Configuração

Clique em **"Salvar"** para ativar o webhook.

## 🔒 Segurança

O webhook está configurado para:
- ✅ Receber notificações do Mercado Pago
- ✅ Validar o `payment_id` antes de processar
- ✅ Verificar o status do pagamento diretamente na API do Mercado Pago
- ✅ Processar de forma assíncrona (não bloqueia a resposta)

## 📝 Formato da Notificação

O Mercado Pago envia notificações no seguinte formato:

```json
{
  "type": "payment",
  "data": {
    "id": "123456789"
  }
}
```

O backend então:
1. Busca o pagamento completo na API do Mercado Pago usando o `id`
2. Verifica o status (`approved`, `rejected`, `pending`, etc.)
3. Atualiza a transação no banco de dados
4. Se aprovado, credita na carteira do usuário

## 🧪 Testando o Webhook

### Opção 1: Usando ngrok (Desenvolvimento Local)

1. Instale o ngrok:
```bash
npm install -g ngrok
# ou
brew install ngrok
```

2. Inicie o ngrok apontando para sua porta do backend:
```bash
ngrok http 3000
```

3. Copie a URL HTTPS gerada (ex: `https://abc123.ngrok.io`)

4. Configure no Mercado Pago:
   - URL: `https://abc123.ngrok.io/api/wallet/webhook`

5. Faça um pagamento de teste e verifique os logs do backend

### Opção 2: Usando o Webhook Tester do Mercado Pago

1. No painel do Mercado Pago, vá em **"Webhooks"**
2. Clique em **"Testar webhook"**
3. Selecione um pagamento de teste
4. O Mercado Pago enviará uma notificação de teste

## 📊 Logs

O backend registra todas as notificações recebidas:

```
🔔 [Webhook] Notificação recebida: { type: 'payment', data: { id: '123456789' } }
🔍 [Webhook] Processando pagamento: 123456789
📊 [Webhook] Status do pagamento: { paymentId: '123456789', status: 'approved', ... }
✅ [Webhook] Pagamento aprovado! Creditando na carteira...
✅ [Webhook] Depósito processado com sucesso!
```

## ⚠️ Importante

1. **Sempre retornar 200 OK**: O webhook sempre retorna `200 OK` para o Mercado Pago, mesmo em caso de erro interno. Isso evita que o Mercado Pago tente reenviar a notificação.

2. **Processamento Assíncrono**: O processamento do webhook é feito de forma assíncrona usando `setImmediate()`, para não bloquear a resposta ao Mercado Pago.

3. **Idempotência**: O sistema verifica se a transação já foi processada antes de creditar novamente, evitando créditos duplicados.

4. **Ambiente de Teste**: Em ambiente de teste (sandbox), os webhooks também funcionam. Configure a URL de teste no painel do Mercado Pago.

## 🔄 Compatibilidade com Polling

O sistema ainda mantém o endpoint `/api/wallet/deposit/confirm` para compatibilidade, mas agora o webhook processa automaticamente quando o pagamento é aprovado. O frontend pode continuar usando polling como fallback, mas não é mais necessário.

## 📚 Documentação Oficial

- [Webhooks do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Tipos de Notificações](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#bookmark_tipos_de_notificações)

