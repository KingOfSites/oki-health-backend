# 🔧 Configuração Completa - Mercado Pago com ngrok

## 📋 Seus Dados da Aplicação

- **User ID**: 1430222536
- **Número da aplicação**: 7562557541145329
- **Integração**: CheckoutTransparente
- **API**: API Pagamentos
- **URL do ngrok**: `https://photodynamical-horace-appliably.ngrok-free.dev`

---

## ⚠️ IMPORTANTE: Resolver o Erro 502

Antes de tudo, você precisa resolver o erro **502 Bad Gateway** que está aparecendo no ngrok. Isso significa que o backend não está rodando ou não está acessível.

### Solução:

1. **Certifique-se de que o backend está rodando:**
   ```bash
   cd oki-health-backend
   npm run dev
   # ou
   npm start
   ```

2. **Verifique se está rodando na porta 3005:**
   - O backend deve estar rodando em `http://localhost:3005`
   - Teste acessando: `http://localhost:3005/api/wallet` (com autenticação)

3. **Verifique o comando do ngrok:**
   ```bash
   ngrok http 3005
   ```
   - Certifique-se de que está expondo a porta **3005** (mesma porta do backend)

4. **Teste se o backend está acessível:**
   - Abra no navegador: `http://localhost:3005`
   - Se não abrir nada, o backend não está rodando

---

## 🔑 Passo 1: Configurar Access Token de Produção

### 1.1 Obter o Token

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Faça login
3. Vá em **"Suas integrações"** → Selecione sua aplicação (ID: 7562557541145329)
4. Na seção **"Credenciais de produção"**, copie o **Access Token**
   - Deve começar com `APP_USR-`

### 1.2 Adicionar no .env

No arquivo `oki-health-backend/.env`, adicione:

```env
# Mercado Pago - PRODUÇÃO
MP_ACCESS_TOKEN=APP_USR-seu-token-aqui
# ou
MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu-token-aqui
```

**⚠️ IMPORTANTE:**
- Use o token de **PRODUÇÃO** (começa com `APP_USR-`)
- NÃO use o token de TEST (começa com `TEST-`)
- O dinheiro dos pagamentos vai automaticamente para a conta associada a este token

### 1.3 Reiniciar o Backend

Após adicionar o token, **reinicie o backend**:

```bash
# Pare o backend (Ctrl+C)
# Depois inicie novamente
npm run dev
```

---

## 🔔 Passo 2: Configurar Webhook no Mercado Pago

### 2.1 URL do Webhook

Use a URL do seu ngrok:

```
https://photodynamical-horace-appliably.ngrok-free.dev/api/wallet/webhook
```

**⚠️ IMPORTANTE:** 
- Esta URL só funciona enquanto o ngrok estiver rodando
- Se você reiniciar o ngrok, a URL muda (a menos que tenha plano pago)
- Para produção real, você precisará de um domínio fixo

### 2.2 Configurar no Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Vá em **"Suas integrações"** → Sua aplicação (ID: 7562557541145329)
3. Procure por **"Webhooks"** ou **"Notificações IPN"**
4. Clique em **"Criar webhook"** ou **"Configurar"**
5. Cole a URL:
   ```
   https://photodynamical-horace-appliably.ngrok-free.dev/api/wallet/webhook
   ```
6. Selecione os eventos:
   - ✅ **payment** (Pagamentos)
7. Clique em **"Salvar"**

### 2.3 Testar o Webhook

Após configurar, você pode testar:

1. No painel do Mercado Pago, há uma opção para **"Enviar notificação de teste"**
2. Ou faça um pagamento real de teste (R$ 1,00)
3. Verifique os logs do backend para ver se o webhook foi recebido

---

## 💰 Como Funciona o Recebimento de Dinheiro

### Conta Recebedora

**O dinheiro vai automaticamente para a conta associada ao Access Token que você configurou.**

- Não precisa configurar nada adicional no código
- O Access Token de produção está vinculado à sua conta do Mercado Pago
- Todos os pagamentos recebidos vão para essa conta
- Você pode verificar as transações no painel do Mercado Pago → "Vendas"

### Taxas do Mercado Pago

O Mercado Pago cobra taxas automaticamente:
- **Cartão de Crédito**: ~4,99% + R$ 0,40 por transação
- **PIX**: ~0,99% por transação (sem taxa fixa)

O valor líquido (após taxas) é o que aparece na sua conta.

---

## 📱 Passo 3: Configurar o App para Conectar ao Backend

### 3.1 Descobrir seu IP Local

**Windows:**
```bash
ipconfig
```
Procure por "IPv4 Address" - algo como `192.168.1.100`

**Mac/Linux:**
```bash
ifconfig
```

### 3.2 Configurar no App

No arquivo `oki-health-native/constants/api.ts`, configure:

```typescript
// Para desenvolvimento local
export const API_BASE_URL = "http://SEU_IP_LOCAL:3005";

// Exemplo:
// export const API_BASE_URL = "http://192.168.1.100:3005";
```

**⚠️ IMPORTANTE:**
- Use o IP local (não `localhost` ou `127.0.0.1`)
- O app precisa conseguir acessar o backend na mesma rede

---

## ✅ Checklist de Configuração

Antes de testar, verifique:

- [ ] Backend está rodando na porta 3005
- [ ] ngrok está rodando e expondo a porta 3005
- [ ] URL do ngrok não está dando erro 502
- [ ] Access Token de PRODUÇÃO configurado no `.env`
- [ ] Backend reiniciado após adicionar o token
- [ ] Webhook configurado no painel do Mercado Pago
- [ ] App configurado para conectar ao IP local do backend
- [ ] Testou se o backend responde: `http://localhost:3005`

---

## 🧪 Como Testar

### 1. Teste de Conexão

1. Abra o app
2. Faça login
3. Tente acessar a carteira
4. Verifique se consegue ver o saldo

### 2. Teste de Depósito (Cartão)

1. Vá em **Carteira** → **Depositar**
2. Digite um valor pequeno (ex: R$ 1,00)
3. Escolha **Cartão de Crédito**
4. Use um cartão de teste ou real
5. Complete o pagamento

**O que deve acontecer:**
- Pagamento processado pelo Mercado Pago
- Saldo creditado na carteira do usuário
- Dinheiro vai para sua conta do Mercado Pago (menos taxas)

### 3. Teste de Depósito (PIX)

1. Vá em **Carteira** → **Depositar**
2. Digite um valor (ex: R$ 1,00)
3. Escolha **PIX**
4. Preencha o CPF
5. Gere o QR Code
6. Pague com o app do banco
7. Aguarde confirmação (pode levar alguns segundos)

**O que deve acontecer:**
- QR Code gerado
- Após pagamento, webhook é chamado (ou polling detecta)
- Saldo creditado na carteira
- Dinheiro vai para sua conta do Mercado Pago

---

## 🐛 Troubleshooting

### Erro 502 no ngrok

**Problema:** Backend não está rodando ou porta errada

**Solução:**
```bash
# Verifique se o backend está rodando
# Teste acessar: http://localhost:3005

# Reinicie o ngrok apontando para a porta correta
ngrok http 3005
```

### Webhook não está funcionando

**Problema:** Mercado Pago não consegue acessar a URL

**Solução:**
1. Certifique-se de que o ngrok está rodando
2. Teste a URL manualmente no navegador
3. Verifique se não há erro 502
4. Verifique os logs do backend

### Pagamento aprovado mas saldo não creditou

**Problema:** Webhook não foi processado ou falhou

**Solução:**
1. Verifique os logs do backend
2. Verifique se o webhook está configurado corretamente
3. O app faz polling a cada 5 segundos - aguarde um pouco
4. Verifique no painel do Mercado Pago se o pagamento foi aprovado

### Access Token inválido

**Problema:** Token errado ou de teste

**Solução:**
1. Certifique-se de usar o token de **PRODUÇÃO** (`APP_USR-...`)
2. Copie o token novamente do painel
3. Reinicie o backend após alterar

---

## 📞 Próximos Passos

Após configurar tudo:

1. ✅ Teste com valores pequenos primeiro (R$ 1,00)
2. ✅ Verifique as transações no painel do Mercado Pago
3. ✅ Monitore os logs do backend
4. ✅ Quando estiver em produção real, configure um domínio fixo para o webhook

---

## 🔒 Segurança

- ✅ Nunca exponha o Access Token no frontend
- ✅ Mantenha o `.env` seguro e não commite no Git
- ✅ Use HTTPS em produção (o ngrok já fornece HTTPS)
- ✅ Monitore transações suspeitas no painel do Mercado Pago

---

## 💡 Dica Final

Quando você colocar o backend em produção (servidor com domínio fixo):

1. Configure o webhook com a URL de produção:
   ```
   https://seu-dominio.com/api/wallet/webhook
   ```

2. O resto da configuração permanece igual!
