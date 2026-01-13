# 🔥 Configuração do Firebase em Produção

## ⚠️ Problema Atual

O erro "Firebase não configurado" ocorre porque as variáveis de ambiente do Firebase não estão configuradas corretamente no arquivo `.env` do backend em produção.

## ✅ Configuração Correta do .env

Baseado nas suas credenciais do Firebase, configure o arquivo `.env` do backend (`oki-health-backend/.env`) com as seguintes variáveis:

```env
# 🔥 Firebase Configuration
FIREBASE_PROJECT_ID=solid-tech-f7b1b
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@solid-tech-f7b1b.iam.gserviceaccount.com
FIREBASE_STORAGE_BUCKET=solid-tech-f7b1b.firebasestorage.app
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEVAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDfV87U1hZA+gfIMJ+K80WF6IyfEW0aIwN/cb7vGRAvUm/GDEf51...\n-----END PRIVATE KEY-----\n"
```

## ⚠️ IMPORTANTE: Formato da Chave Privada

A chave privada (`FIREBASE_PRIVATE_KEY`) **DEVE** estar no formato correto:

### ✅ Formato Correto (com `\n`)

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEVAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDfV87U1hZA+gfIMJ+K80WF6IyfEW0aIwN/cb7vGRAvUm/GDEf51...\n-----END PRIVATE KEY-----\n"
```

### ❌ Formato Incorreto (com `\M` ou sem `\n`)

```env
# ERRADO - não use \M
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\MIIEVAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDfV87U1hZA+gfIMJ+K80WF6IyfEW0aIwN/cb7vGRAvUm/GDEf51...\n-----END PRIVATE KEY-----\n"
```

## 📝 Passos para Configurar

1. **Acesse o servidor de produção** onde o backend está rodando

2. **Localize o arquivo `.env`** do backend:
   ```bash
   cd /caminho/para/oki-health-backend
   # ou
   cd ~/oki-health-backend
   ```

3. **Edite o arquivo `.env`** e adicione/atualize as variáveis do Firebase:
   ```bash
   nano .env
   # ou
   vi .env
   ```

4. **Copie e cole as variáveis** (substitua `...` pela chave completa):
   ```env
   FIREBASE_PROJECT_ID=solid-tech-f7b1b
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@solid-tech-f7b1b.iam.gserviceaccount.com
   FIREBASE_STORAGE_BUCKET=solid-tech-f7b1b.firebasestorage.app
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEVAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDfV87U1hZA+gfIMJ+K80WF6IyfEW0aIwN/cb7vGRAvUm/GDEf51...\n-----END PRIVATE KEY-----\n"
   ```

5. **IMPORTANTE**: A chave privada deve:
   - ✅ Começar com `-----BEGIN PRIVATE KEY-----`
   - ✅ Terminar com `-----END PRIVATE KEY-----`
   - ✅ Ter `\n` (barra invertida + n) para quebras de linha, **NÃO** `\M`
   - ✅ Estar entre aspas duplas `"`
   - ✅ Incluir a chave completa (não apenas o início)

6. **Salve o arquivo** e **reinicie o backend**:
   ```bash
   # Se estiver usando PM2:
   pm2 restart oki-health-backend
   
   # Se estiver usando npm:
   # Pare o processo (Ctrl+C) e rode:
   npm run build
   npm start
   
   # Se estiver usando systemd:
   sudo systemctl restart oki-health-backend
   ```

7. **Verifique os logs** do backend. Você deve ver:
   ```
   🔥 Firebase Admin inicializado com sucesso!
   ```

## 🔍 Como Obter a Chave Privada Completa

Se você não tiver a chave privada completa:

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Selecione o projeto `solid-tech-f7b1b`
3. Vá em **Configurações do Projeto** (ícone de engrenagem)
4. Aba **Contas de Serviço**
5. Clique em **Gerar nova chave privada** (ou use a existente)
6. Baixe o arquivo JSON
7. Abra o JSON e copie o valor de `private_key`
8. Use esse valor no `.env`, substituindo todas as quebras de linha reais por `\n`

## 🧪 Teste a Configuração

Após configurar, teste fazendo upload de uma imagem pelo app. Se funcionar, você verá nos logs do backend:

```
[Chat Upload] 🔥 Firebase Storage: Iniciando upload para chat/...
[Chat Upload] ✅ Upload concluído no Firebase Storage!
```

## ❌ Se Ainda Não Funcionar

1. **Verifique se todas as variáveis estão presentes**:
   ```bash
   # No servidor, rode:
   grep FIREBASE .env
   ```

2. **Verifique se não há espaços extras**:
   ```bash
   # Certifique-se de que não há espaços antes ou depois do =
   FIREBASE_PROJECT_ID=solid-tech-f7b1b  # ✅ Correto
   FIREBASE_PROJECT_ID = solid-tech-f7b1b  # ❌ Errado (espaços)
   ```

3. **Verifique se a chave privada está completa**:
   - A chave deve ter várias linhas de caracteres base64
   - Não deve estar truncada ou cortada

4. **Verifique os logs do backend** ao iniciar:
   - Se aparecer `⚠️ Firebase não configurado`, as variáveis não estão sendo lidas
   - Se aparecer `⚠️ Firebase configurado mas chave privada inválida`, a chave está mal formatada
   - Se aparecer `❌ Erro ao inicializar Firebase Admin`, há um problema com as credenciais

## 📞 Precisa de Ajuda?

Se após seguir todos os passos o erro persistir:
1. Verifique se o arquivo `.env` está no diretório correto (`oki-health-backend/.env`)
2. Verifique se o backend está lendo o arquivo `.env` (não `.env.local` ou outro)
3. Verifique se não há caracteres especiais ou encoding incorreto no arquivo
4. Tente copiar a chave privada diretamente do JSON do Firebase, substituindo `\n` por `\\n` no `.env`
