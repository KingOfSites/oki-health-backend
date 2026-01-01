# ⚡ Guia Rápido: Adicionar Credenciais de Produção

## 📝 Passo a Passo

### 1. Abra o arquivo `.env`

No Windows PowerShell:
```powershell
cd oki-health-backend
notepad .env
```

Ou abra manualmente o arquivo `.env` na pasta `oki-health-backend/`

### 2. Adicione estas linhas no final do arquivo

```env
# ============================================
# MERCADO PAGO - PRODUÇÃO
# ============================================
MP_ACCESS_TOKEN=APP_USR-7562557541145329-123108-9ca9146916467b6aef55fc3a2c31f0d7-1430222536
MP_WEBHOOK_SECRET=4db438e07edbc035abb4596fb870c6935e7e6ec02f539564b46d1e1288615a9e
```

### 3. Salve o arquivo (Ctrl+S)

### 4. Reinicie o backend

```powershell
# Pare o backend (Ctrl+C) e reinicie:
npm run dev
```

### 5. Verifique nos logs

Você deve ver:
```
✅ [Mercado Pago] Configurado - Modo: PRODUÇÃO
   Token: APP_USR...2536
⚠️  ATENÇÃO: Você está em modo PRODUÇÃO - transações serão REAIS!
✅ [Mercado Pago] Webhook Secret configurado
```

## ✅ Pronto!

Agora você está em modo de PRODUÇÃO e pode receber pagamentos reais.

---

**⚠️ LEMBRE-SE:** Transações agora são REAIS - dinheiro será transferido de verdade!
