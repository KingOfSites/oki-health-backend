# Oki Backend API

Backend API para o aplicativo Oki Health, construído com TypeScript, Express e Prisma.

## 🚀 Tecnologias

- **Node.js** - Runtime JavaScript
- **TypeScript** - Superset JavaScript com tipagem estática
- **Express** - Framework web
- **Prisma** - ORM para banco de dados
- **MySQL** - Banco de dados relacional
- **JWT** - Autenticação via tokens
- **Bcrypt** - Criptografia de senhas
- **Zod** - Validação de schemas

## 📋 Pré-requisitos

- Node.js >= 18.0.0
- MySQL
- npm ou yarn

## 🔧 Instalação

1. Clone o repositório e entre na pasta do backend:

```bash
cd oki-backend
```

2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente:

```bash
cp env.example .env
```

4. Edite o arquivo `.env` com suas configurações:

```env
DATABASE_URL="mysql://user:password@localhost:3306/oki_db"
JWT_SECRET="sua-chave-secreta-super-segura-mude-em-producao"
JWT_EXPIRES_IN="7d"
PORT=3002
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:3005,https://oki.solidtech.digital,https://app-invite-landing.vercel.app"
```

5. Execute as migrations do Prisma:

```bash
npx prisma migrate dev --name init
```

6. Gere o Prisma Client:

```bash
npx prisma generate
```

## 🏃 Executando

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
npm run build
npm start
```

## 🗄️ Database

### Ver o banco de dados (Prisma Studio)

```bash
npm run prisma:studio
```

### Criar nova migration

```bash
npx prisma migrate dev --name nome_da_migration
```

### Deploy migrations em produção

```bash
npm run prisma:migrate
```

## 📡 Endpoints da API

### Health Check

```
GET /api/health
```

### Autenticação

#### Cadastro de usuário

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "usuario@email.com",
  "password": "senha123",
  "name": "Nome Completo",
  "age": 25,
  "city": "São Paulo"
}
```

#### Login

```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

#### Obter perfil (requer autenticação)

```http
GET /api/auth/profile
Authorization: Bearer {token}
```

## 🚂 Deploy no Railway

### Configuração

1. Crie uma conta no [Railway](https://railway.app)

2. Crie um novo projeto e adicione um MySQL

3. Adicione as seguintes variáveis de ambiente no Railway:

   - `DATABASE_URL` (será preenchida automaticamente pelo MySQL)
   - `JWT_SECRET` (gere uma chave segura)
   - `JWT_EXPIRES_IN` (ex: "7d")
   - `NODE_ENV` ("production")
   - `ALLOWED_ORIGINS` (URL do seu frontend)

4. Conecte seu repositório Git ao Railway

5. O Railway detectará automaticamente o `package.json` e fará o build

### Build e Deploy automático

O Railway executará automaticamente:

```bash
npm install
npm run prisma:generate
npm run build
npm run prisma:migrate
npm start
```

### Comandos úteis no Railway

Para rodar comandos no Railway CLI:

```bash
# Login
railway login

# Link ao projeto
railway link

# Ver logs
railway logs

# Rodar comandos
railway run npm run prisma:studio
```

## 🔐 Segurança

- Senhas criptografadas com bcrypt
- Autenticação via JWT
- Validação de entrada com Zod
- Helmet para headers de segurança
- CORS configurável
- Proteção contra SQL injection (Prisma)

## 📝 Estrutura do Projeto

```
oki-backend/
├── prisma/
│   └── schema.prisma       # Schema do banco de dados
├── src/
│   ├── config/             # Configurações
│   │   ├── database.ts
│   │   └── env.ts
│   ├── controllers/        # Controllers
│   │   └── auth.controller.ts
│   ├── middleware/         # Middlewares
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   └── validation.ts
│   ├── routes/             # Rotas
│   │   ├── auth.routes.ts
│   │   └── index.ts
│   ├── services/           # Lógica de negócio
│   │   └── auth.service.ts
│   ├── utils/              # Utilitários
│   │   ├── jwt.ts
│   │   └── password.ts
│   ├── validators/         # Validadores Zod
│   │   └── auth.validator.ts
│   └── index.ts            # Entry point
├── .gitignore
├── env.example
├── package.json
├── README.md
└── tsconfig.json
```

## 🧪 Testando a API

Você pode usar Postman, Insomnia ou curl para testar:

```bash
# Health check
curl http://localhost:3002/api/health

# Criar usuário
curl -X POST http://localhost:3002/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "password": "senha123",
    "name": "Teste Usuario",
    "age": 25,
    "city": "São Paulo"
  }'

# Login
curl -X POST http://localhost:3002/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@email.com",
    "password": "senha123"
  }'
```

## 📄 Licença

MIT
