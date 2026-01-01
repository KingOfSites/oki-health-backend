# ✅ Verificar Configuração de Credenciais

## ⚠️ IMPORTANTE: O sistema agora BLOQUEIA tokens de teste

O código foi atualizado para **NÃO ACEITAR** tokens de teste. Apenas tokens de produção são permitidos.

## 📝 Verificar seu arquivo .env

### 1. Abra o arquivo `.env`

O arquivo está em: `oki-health-backend/.env`

### 2. Verifique se tem estas linhas:

```env
MP_ACCESS_TOKEN=APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536
MP_WEBHOOK_SECRET=4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e
```

### 3. ❌ Se você vir algo assim (ERRADO):

```env
MP_ACCESS_TOKEN=TEST-...
```

**AÇÃO:** Substitua por:
```env
MP_ACCESS_TOKEN=APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536
```

### 4. ✅ Certifique-se de que começa com `APP_USR-`

O token correto DEVE começar com `APP_USR-` (não `TEST-`)

## 🔄 Após Atualizar

1. **Salve o arquivo** (Ctrl+S)
2. **Reinicie o backend**:
   ```bash
   # Pare (Ctrl+C) e reinicie
   npm run dev
   ```

3. **Verifique nos logs** - você deve ver:
   ```
   ✅ [Mercado Pago] Configurado - Modo: PRODUÇÃO
      Token: APP_USR...2536
   ⚠️  ATENÇÃO: Você está em modo PRODUÇÃO - transações serão REAIS!
   💰 Pagamentos serão processados com dinheiro REAL!
   ✅ [Mercado Pago] Webhook Secret configurado
   ```

## ❌ Se aparecer erro

Se você ver:
```
❌ [Mercado Pago] ERRO: Token de TESTE detectado!
⚠️  APENAS tokens de PRODUÇÃO são permitidos neste sistema!
```

**Isso significa:**
- Você ainda tem um token de teste no `.env`
- Substitua por `APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536`
- Reinicie o backend

## ✅ Token Correto de Produção

```
APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536
```

Este é o token que você deve usar!
