# 🔑 Credenciais de Produção - Mercado Pago

## ✅ Credenciais Configuradas

Todas as credenciais de produção foram configuradas:

### 🔐 Credenciais Principais

1. **Access Token** (Principal - usado no backend)
   ```
   APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536
   ```
   - ✅ Configurado no código
   - ✅ Usado para criar pagamentos

2. **Webhook Secret** (Validação de webhooks)
   ```
   4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e
   ```
   - ✅ Configurado no código
   - ✅ Usado para validar assinaturas HMAC-SHA256

### 📋 Credenciais Adicionais (Para Referência)

3. **Client ID**
   ```
   7562557541145329
   ```

4. **Client Secret**
   ```
   wVa2cAvhBHavxRiL49KqkOTQitr0FI4E
   ```

5. **Public Key**
   ```
   APP_USR-ea648cdd-eb13-4309-9dff-da6377fd71e1
   ```
   - Usado no frontend se necessário (Checkout Pro, etc)

## 📝 Como Usar

### 1. Copiar para arquivo .env

Copie o conteúdo do arquivo `.env.production` para o seu arquivo `.env` na pasta `oki-health-backend/`:

```bash
# No terminal, dentro da pasta oki-health-backend:
cp .env.production .env
```

Ou manualmente, copie as linhas do Mercado Pago:

```env
# Mercado Pago - PRODUÇÃO
MP_ACCESS_TOKEN=APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536
MP_WEBHOOK_SECRET=4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e
```

### 2. Reiniciar o Backend

Após adicionar no `.env`, reinicie o backend:

```bash
cd oki-health-backend
npm run dev
```

### 3. Verificar nos Logs

Você deve ver nos logs:

```
✅ [Mercado Pago] Configurado - Modo: PRODUÇÃO
   Token: APP_USR...2536
⚠️  ATENÇÃO: Você está em modo PRODUÇÃO - transações serão REAIS!
✅ [Mercado Pago] Webhook Secret configurado
```

## ⚠️ IMPORTANTE - SEGURANÇA

1. **NUNCA compartilhe essas credenciais** publicamente
2. **NUNCA faça commit** do arquivo `.env` no Git
3. **NUNCA exponha** essas credenciais no frontend
4. **Mantenha seguro** - essas credenciais têm acesso completo à sua conta

## 🔒 O que cada credencial faz

- **Access Token**: Autentica requisições da API do Mercado Pago (backend)
- **Webhook Secret**: Valida que as notificações vêm do Mercado Pago
- **Client ID**: Identifica sua aplicação (não usado no código atual)
- **Client Secret**: Segredo da aplicação (não usado no código atual)
- **Public Key**: Usado no frontend para algumas integrações (não usado no código atual)

## ✅ Status

- ✅ Access Token configurado
- ✅ Webhook Secret configurado
- ✅ Código pronto para produção
- ✅ Validação de webhook ativa
- ✅ Todas as credenciais documentadas

## 🚀 Próximos Passos

1. Adicione as credenciais no arquivo `.env`
2. Reinicie o backend
3. Teste um pagamento real (valor pequeno primeiro!)
4. Monitore os logs para verificar que tudo está funcionando

---

**Lembre-se:** Você está em modo de PRODUÇÃO agora - transações serão REAIS e dinheiro será transferido de verdade!
