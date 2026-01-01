# 🚀 Guia de Configuração do Mercado Pago em Produção

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

1. ✅ Uma conta no Mercado Pago (conta real, não de teste)
2. ✅ Aplicação criada no [Painel de Desenvolvedores do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
3. ✅ Seus dados da aplicação (conforme a imagem mostrada):
   - **User ID**: 1430222536
   - **Número da aplicação**: 7562557541145329
   - **Integração**: CheckoutTransparente
   - **API**: API Pagamentos

---

## 🔑 Passo 1: Obter o Access Token de Produção

### 1.1 Acessar o Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Faça login com sua conta do Mercado Pago
3. Vá em **"Suas integrações"** → Selecione sua aplicação (ID: 7562557541145329)

### 1.2 Copiar o Access Token

1. Na página da aplicação, procure por **"Credenciais de produção"**
2. Você verá:
   - **Public Key** (não é o que precisamos)
   - **Access Token** (PRODUCTION) ← **Este é o que precisamos!**

3. Clique no ícone de **copiar** ao lado do Access Token

⚠️ **IMPORTANTE**: 
- Use o **Access Token de PRODUÇÃO** (não o de TEST)
- Este token começa com `APP_USR-` (produção) e não `TEST-`

---

## ⚙️ Passo 2: Configurar no Backend

### 2.1 Adicionar Variável de Ambiente

No arquivo `.env` do backend (`oki-health-backend/.env`), adicione:

```env
# Mercado Pago - PRODUÇÃO
MP_ACCESS_TOKEN=APP_USR-seu-access-token-de-producao-aqui
# ou (ambos funcionam)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu-access-token-de-producao-aqui
```

**Exemplo:**
```env
MP_ACCESS_TOKEN=APP_USR-1234567890-123456-abcdefghijklmnopqrstuvwxyz-123456789
```

### 2.2 Reiniciar o Backend

Após adicionar a variável, reinicie o servidor:

```bash
cd oki-health-backend
npm run dev
# ou
npm start
```

---

## 🔔 Passo 3: Configurar Webhook para Produção

O webhook é necessário para receber notificações automáticas quando um pagamento é aprovado.

### 3.1 Preparar URL do Webhook

Você precisa de uma URL HTTPS pública para o webhook. Opções:

**Opção A: Servidor em produção com domínio**
```
https://seu-dominio.com/api/wallet/webhook
```

**Opção B: Usar ngrok (para testes temporários)**
```bash
# Instalar ngrok
npm install -g ngrok

# Expor seu backend local
ngrok http 3005

# Use a URL gerada (ex: https://abc123.ngrok.io/api/wallet/webhook)
```

### 3.2 Configurar no Mercado Pago

1. No Painel do Mercado Pago → Sua aplicação
2. Vá em **"Webhooks"** ou **"Notificações IPN"**
3. Clique em **"Criar webhook"** ou **"Configurar"**
4. Cole a URL do webhook: `https://seu-dominio.com/api/wallet/webhook`
5. Selecione os eventos:
   - ✅ **payment** (Pagamentos)
6. Salve

### 3.3 Verificar se o Webhook está funcionando

O backend já tem o endpoint configurado em:
```
POST /api/wallet/webhook
```

Você pode testar enviando uma notificação de teste do painel do Mercado Pago.

---

## 💳 Passo 4: Testar Pagamentos Reais

### 4.1 Cartões de Teste para Produção

O Mercado Pago permite testar com cartões reais em modo de teste, mas para produção você precisará usar:

#### Para TESTAR sem cobrar (modo sandbox):
Use cartões de teste que começam com:
- **Mastercard**: 5031 4332 1540 6351
- **Visa**: 4509 9535 6623 3704
- **CVV**: Qualquer 3 dígitos
- **Data**: Qualquer data futura

#### Para COBRAR REALMENTE (produção):
Use um cartão REAL de teste seu (com limite pequeno) ou cartões específicos do Mercado Pago para produção.

⚠️ **ATENÇÃO**: Em produção, os pagamentos serão **REAIS** e o dinheiro será **DEBITADO** do cartão!

### 4.2 Fluxo de Teste no App

1. **Abrir o app** e fazer login
2. **Ir para "Carteira"** → **"Depositar"**
3. **Inserir um valor** (ex: R$ 1,00 para testar)
4. **Escolher método de pagamento**:
   - **Cartão de Crédito**: Preencher dados
   - **PIX**: Gerará QR Code para pagar

### 4.3 Verificar o Pagamento

Após o pagamento:

1. **No app**: Verifique se o saldo foi creditado
2. **No backend**: Verifique os logs do console
3. **No Mercado Pago**: 
   - Painel → **"Vendas"** → Ver a transação
   - Status: "approved", "pending" ou "rejected"

---

## 🔍 Passo 5: Verificar Configurações no Painel

### 5.1 Configurações da Aplicação

No painel do Mercado Pago, verifique:

1. **Integração**: Deve estar como "CheckoutTransparente" ✅
2. **API integrada**: "API Pagamentos" ✅
3. **Ambiente**: **PRODUÇÃO** (não TEST)

### 5.2 Configurações de Notificação

- ✅ Webhook configurado e ativo
- ✅ URL do webhook acessível (HTTPS)
- ✅ Eventos configurados: "payment"

---

## 📱 Passo 6: Testar no Aplicativo

### 6.1 Depósito via Cartão

```
1. App → Carteira → Depositar
2. Inserir valor: R$ 10,00
3. Confirmar Depósito
4. Escolher "Cartão de Crédito"
5. Preencher:
   - Número: [usar cartão de teste ou real]
   - Nome: [nome do portador]
   - Validade: [MM/AA]
   - CVV: [3 dígitos]
   - CPF: [CPF válido]
6. Confirmar pagamento
```

### 6.2 Depósito via PIX

```
1. App → Carteira → Depositar
2. Inserir valor: R$ 10,00
3. Confirmar Depósito
4. Escolher "PIX"
5. Preencher CPF
6. Ver QR Code gerado
7. Pagar com app do banco
8. Aguardar confirmação (webhook)
```

---

## ✅ Checklist de Produção

Antes de liberar para usuários reais, verifique:

- [ ] Access Token de PRODUÇÃO configurado no `.env`
- [ ] Backend rodando com as variáveis corretas
- [ ] Webhook configurado e testado
- [ ] Testado depósito via cartão com valor pequeno (R$ 1,00)
- [ ] Testado depósito via PIX
- [ ] Verificado que o saldo é creditado corretamente
- [ ] Verificado logs de erro no backend
- [ ] Verificado transações no painel do Mercado Pago
- [ ] Configurado notificações/alertas para pagamentos importantes

---

## 🐛 Troubleshooting

### Erro: "Access token inválido"

**Solução**: 
- Verifique se está usando o token de PRODUÇÃO (começa com `APP_USR-`)
- Certifique-se que o token está correto no `.env`
- Reinicie o backend após alterar o `.env`

### Pagamento aprovado mas saldo não creditado

**Solução**:
- Verifique se o webhook está configurado corretamente
- Verifique os logs do backend para erros no processamento do webhook
- Verifique se a URL do webhook está acessível publicamente (HTTPS)

### Webhook não está recebendo notificações

**Solução**:
- Verifique se a URL do webhook está correta no painel do Mercado Pago
- Teste a URL manualmente (deve retornar 200 OK)
- Use ngrok para testar localmente antes de colocar em produção

### Erro ao processar pagamento

**Solução**:
- Verifique os logs do backend
- Verifique se todos os dados estão sendo enviados corretamente
- Verifique se o CPF está no formato correto (apenas números, 11 dígitos)

---

## 📞 Suporte

Se tiver problemas:

1. **Logs do Backend**: Verifique o console do servidor
2. **Painel do Mercado Pago**: Verifique as transações e notificações
3. **Documentação do Mercado Pago**: https://www.mercadopago.com.br/developers/pt/docs

---

## 🔒 Segurança

⚠️ **IMPORTANTE**:
- Nunca exponha o Access Token no frontend
- Mantenha o token apenas no backend (`.env`)
- Use HTTPS em produção
- Monitore transações suspeitas
- Configure limites de transação se necessário

---

## 💰 Taxas do Mercado Pago

Lembre-se que o Mercado Pago cobra taxas por transação:

- **Cartão de Crédito**: ~4,99% + R$ 0,40
- **PIX**: ~0,99% (sem taxa fixa)

Essas taxas são descontadas automaticamente pelo Mercado Pago.

---

## ✅ Pronto!

Após seguir todos os passos, sua integração com Mercado Pago estará funcionando em produção!

Teste com valores pequenos primeiro antes de liberar para todos os usuários.
