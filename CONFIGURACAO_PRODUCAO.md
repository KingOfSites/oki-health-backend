# 🚀 Configuração para Produção - Mercado Pago

## ✅ Dados Fornecidos

- **Webhook Secret**: `4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e` ✅
- **Application Number**: `7562557541145329` ✅
- **User ID**: `1430222536` ✅
- **Webhook Configurado**: ✅ (já configurado no painel do Mercado Pago)

## 🔑 Variáveis de Ambiente Necessárias

Adicione estas variáveis no seu arquivo `.env` na pasta `oki-health-backend/`:

```env
# ============================================
# MERCADO PAGO - PRODUÇÃO
# ============================================

# Access Token de PRODUÇÃO ✅ CONFIGURADO
MP_ACCESS_TOKEN=APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536

# Webhook Secret ✅ CONFIGURADO
MP_WEBHOOK_SECRET=4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e

# Credenciais adicionais (para referência)
MP_CLIENT_ID=7562557541145329
MP_CLIENT_SECRET=wVa2cAvhBHavxRiL49KqkOTQitr0FI4E
MP_PUBLIC_KEY=APP_USR-ea648cdd-eb13-4309-9dff-da6377fd71e1

# Também pode usar estes nomes alternativos (caso já esteja usando):
# MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu-access-token-de-producao-aqui
# MERCADOPAGO_WEBHOOK_SECRET=4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e
```

## 📋 Como Obter o Access Token de Produção

1. **Acesse o Painel do Mercado Pago:**
   - https://www.mercadopago.com.br/developers/panel/app/7562557541145329/credentials

2. **Vá em "Credenciais"**

3. **Copie o "Access Token" de PRODUÇÃO:**
   - Deve começar com `APP_USR-`
   - NÃO use o token de TESTE (que começa com `TEST-`)

4. **Cole no arquivo `.env`:**
   ```env
   MP_ACCESS_TOKEN=APP_USR-seu-token-aqui
   ```

## ✅ Verificações

Após configurar, quando você reiniciar o backend, você deve ver nos logs:

```
✅ [Mercado Pago] Configurado - Modo: PRODUÇÃO
   Token: APP_USR...xxxx
```

Se aparecer "TESTE", verifique se o token está correto (deve começar com `APP_USR-`).

## 🔒 Segurança do Webhook

O código agora valida automaticamente a assinatura do webhook usando HMAC-SHA256. Isso garante que apenas o Mercado Pago pode enviar notificações válidas.

**A validação funciona assim:**
1. Mercado Pago envia a assinatura no header `x-signature`
2. O backend calcula a assinatura usando o `MP_WEBHOOK_SECRET`
3. Compara as assinaturas de forma segura
4. Se não corresponderem, a requisição é rejeitada

## 🌐 URL do Webhook

Certifique-se de que o webhook está configurado no Mercado Pago apontando para:

```
https://seu-dominio.com/api/wallet/webhook
```

Ou se estiver usando ngrok:

```
https://seu-ngrok-url.ngrok.io/api/wallet/webhook
```

## 📝 Exemplo Completo do .env

```env
# Database
DATABASE_URL=mysql://root:senha@host:porta/database

# Server
PORT=3005
NODE_ENV=production

# JWT
JWT_SECRET=sua-chave-secreta-super-segura-mude-em-producao-minimo-32-caracteres

# Mercado Pago - PRODUÇÃO ✅ CONFIGURADO
MP_ACCESS_TOKEN=APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536
MP_WEBHOOK_SECRET=4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e

# URLs (ajuste conforme necessário)
BACKEND_URL=https://seu-dominio.com
FRONTEND_URL=https://seu-dominio.com
ALLOWED_ORIGINS=https://seu-dominio.com
```

## ⚠️ IMPORTANTE

1. **NUNCA compartilhe seu Access Token** - ele tem acesso completo à sua conta
2. **Use apenas tokens de PRODUÇÃO em produção** - não use tokens de teste
3. **Mantenha o Webhook Secret seguro** - ele valida que as notificações vêm do Mercado Pago
4. **Teste em modo de teste primeiro** - use tokens `TEST-` para testar antes de ir para produção

## 🔄 Próximos Passos

1. ✅ Adicione o `MP_ACCESS_TOKEN` de produção no `.env`
2. ✅ Verifique se o `MP_WEBHOOK_SECRET` está correto (já configurado)
3. ✅ Reinicie o backend
4. ✅ Verifique os logs para confirmar que está em modo PRODUÇÃO
5. ✅ Teste um pagamento real
