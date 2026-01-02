# 🔥 Guia de Configuração do Firebase

## ❌ Erro Atual

Se você está vendo este erro:
```
Failed to parse private key: Error: Unparsed DER bytes remain after ASN.1 parsing.
```

Isso significa que a **chave privada do Firebase está mal formatada** no arquivo `.env`.

## ✅ Solução Passo a Passo

### 1. Obter as Credenciais do Firebase

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em **Configurações do Projeto** (ícone de engrenagem)
4. Aba **Contas de Serviço**
5. Clique em **Gerar nova chave privada**
6. Baixe o arquivo JSON

### 2. Extrair as Informações do JSON

O arquivo JSON baixado terá este formato:
```json
{
  "type": "service_account",
  "project_id": "seu-projeto-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### 3. Configurar no Arquivo `.env`

Abra o arquivo `oki-health-backend/.env` e adicione/atualize estas variáveis:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=seu-projeto-id.appspot.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

### 4. Formato Correto da Chave Privada

⚠️ **IMPORTANTE**: A chave privada pode ser configurada de **duas formas**:

#### Opção 1: Com `\n` (recomendado para .env)
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

#### Opção 2: Com quebras de linha reais (multilinha)
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----"
```

### 5. Verificações Importantes

✅ A chave deve começar com `-----BEGIN PRIVATE KEY-----`
✅ A chave deve terminar com `-----END PRIVATE KEY-----`
✅ Não remova nenhum caractere da chave
✅ Mantenha todas as quebras de linha (`\n` ou reais)
✅ Use aspas duplas `"` ao redor da chave no `.env`

### 6. Exemplo Completo

```env
# Firebase
FIREBASE_PROJECT_ID=meu-projeto-12345
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@meu-projeto-12345.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=meu-projeto-12345.appspot.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKjMzEfYyjiWA4R4/M2bN1\nEv0Wa2+5x0k8Uy5jF5y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y\n5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y\n-----END PRIVATE KEY-----\n"
```

### 7. Após Configurar

1. **Salve o arquivo `.env`**
2. **Reinicie o backend** completamente:
   ```bash
   cd oki-health-backend
   # Pare o servidor (Ctrl+C)
   npm run dev
   ```

3. **Verifique os logs**: Você deve ver:
   ```
   🔥 Firebase Admin inicializado com sucesso!
   ```

Se ainda aparecer erro, verifique:
- [ ] A chave está entre aspas duplas?
- [ ] A chave tem `-----BEGIN PRIVATE KEY-----` no início?
- [ ] A chave tem `-----END PRIVATE KEY-----` no final?
- [ ] As quebras de linha estão como `\n` ou reais?
- [ ] Não há espaços extras no início/fim da chave?

## 🚫 Se Não Precisar do Firebase

Se você **não vai usar** upload de imagens pelo Firebase, você pode:

1. **Remover ou comentar** as variáveis do Firebase no `.env`:
   ```env
   # FIREBASE_PROJECT_ID=...
   # FIREBASE_CLIENT_EMAIL=...
   # FIREBASE_PRIVATE_KEY=...
   # FIREBASE_STORAGE_BUCKET=...
   ```

2. O sistema continuará funcionando normalmente, apenas o upload de imagens ficará desabilitado.

## 📞 Precisa de Ajuda?

Se após seguir todos os passos o erro persistir, verifique:
1. O arquivo JSON baixado está completo?
2. Você copiou a chave completa (incluindo BEGIN e END)?
3. Não há caracteres extras ou faltando na chave?
