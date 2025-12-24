# 🔧 Configuração do Arquivo .env

## ⚠️ IMPORTANTE: Variáveis Obrigatórias

Seu arquivo `.env` precisa ter **pelo menos** estas variáveis:

```env
# Database (OBRIGATÓRIO)
DATABASE_URL=mysql://root:Ujaifhnfoeunroginen81u3ni@217.196.51.2:3310/oki_health

# JWT Secret (OBRIGATÓRIO - mínimo 32 caracteres)
JWT_SECRET=sua-chave-secreta-super-segura-mude-em-producao-minimo-32-caracteres

# Porta do servidor (opcional, padrão: 3005)
PORT=3005

# Ambiente (opcional, padrão: development)
NODE_ENV=development
```

## 📝 Exemplo Completo do .env

Crie ou edite o arquivo `oki-health-backend/.env` com este conteúdo:

```env
# ============================================
# CONFIGURAÇÃO DO BACKEND
# ============================================

# Database
DATABASE_URL=mysql://root:Ujaifhnfoeunroginen81u3ni@217.196.51.2:3310/oki_health

# Server
PORT=3005
NODE_ENV=development

# JWT Authentication (OBRIGATÓRIO - mínimo 32 caracteres)
JWT_SECRET=sua-chave-secreta-super-segura-mude-em-producao-minimo-32-caracteres-123456789

# JWT Expiration (opcional, padrão: 7d)
JWT_EXPIRES_IN=7d

# CORS - URLs permitidas (separadas por vírgula)
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000,http://127.0.0.1:8080

# URLs (opcionais)
BACKEND_URL=http://localhost:3005
FRONTEND_URL=http://localhost:8080

# Firebase (OPCIONAL - apenas se você usar Firebase)
# FIREBASE_PROJECT_ID=seu-projeto
# FIREBASE_CLIENT_EMAIL=seu-email@projeto.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# FIREBASE_STORAGE_BUCKET=seu-bucket.appspot.com

# Mercado Pago (opcional)
# MERCADOPAGO_ACCESS_TOKEN=seu-token
```

## 🚀 Como Configurar

1. **Abra o arquivo `.env`** na pasta `oki-health-backend/`

2. **Certifique-se de ter pelo menos**:
   - `DATABASE_URL` (já deve estar configurado)
   - `JWT_SECRET` (adicione uma chave com pelo menos 32 caracteres)

3. **Salve o arquivo**

4. **Reinicie o backend**:
   ```bash
   cd oki-health-backend
   npm run dev
   ```

## ✅ Verificação

Após configurar, você deve ver no console do backend:
```
✅ Database connected
🚀 Server running on port 3005
🔗 API base URL: http://localhost:3005/api
```

Se aparecer erro sobre variáveis de ambiente, verifique se todas as obrigatórias estão no `.env`.

## 🔑 Gerar JWT_SECRET Seguro

Para gerar uma chave JWT segura, você pode usar:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ou online: https://generate-secret.vercel.app/32
```

