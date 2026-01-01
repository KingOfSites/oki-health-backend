# 💰 Sistema de Solicitações de Saque

## 📋 Visão Geral

O sistema de saque foi reformulado para funcionar através de **solicitações** que são analisadas e processadas manualmente por um administrador. Isso oferece maior controle e segurança sobre os saques.

## 🔄 Fluxo do Sistema

### 1. **Usuário Cria Solicitação**
```
Usuário preenche dados bancários
  ↓
Sistema valida saldo disponível
  ↓
Cria solicitação com status "pending"
  ↓
Saldo NÃO é debitado ainda
```

### 2. **Admin Analisa Solicitação**
```
Admin visualiza todas as solicitações pendentes
  ↓
Admin pode:
  - Aprovar (status: "approved")
  - Rejeitar (status: "rejected") com motivo
```

### 3. **Admin Processa Saque**
```
Admin marca como "completed"
  ↓
Sistema debita da carteira
  ↓
Cria transação de saque
  ↓
Atualiza total_withdrawn do usuário
```

## 📊 Modelo de Dados

### Tabela: `withdrawal_requests`

```sql
- id: UUID
- userId: UUID (FK para users)
- amount: DECIMAL(10,2)
- status: VARCHAR(20) 
  - "pending" - Aguardando análise
  - "approved" - Aprovado pelo admin
  - "rejected" - Rejeitado pelo admin
  - "completed" - Saque processado
- fullName: VARCHAR(255)
- cpf: VARCHAR(11)
- bankName: VARCHAR(255)
- agency: VARCHAR(50)
- account: VARCHAR(50)
- accountType: VARCHAR(20) ("checking" ou "savings")
- adminNotes: TEXT (notas do admin)
- processedAt: DATETIME
- processedBy: UUID (ID do admin)
- created_at: DATETIME
- updated_at: DATETIME
```

## 🔌 Endpoints da API

### 1. **Criar Solicitação de Saque** (Usuário)
```
POST /api/wallet/withdraw
Authorization: Bearer {token}

Body:
{
  "amount": 100.00,
  "fullName": "João Silva",
  "cpf": "12345678909",
  "bankName": "Banco do Brasil",
  "agency": "1234",
  "account": "12345-6",
  "accountType": "checking" // ou "savings"
}

Response:
{
  "success": true,
  "message": "Solicitação de saque criada com sucesso",
  "data": {
    "id": "uuid",
    "amount": 100.00,
    "status": "pending"
  }
}
```

### 2. **Listar Minhas Solicitações** (Usuário)
```
GET /api/wallet/withdrawal-requests/my
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "amount": 100.00,
      "status": "pending",
      "fullName": "João Silva",
      "bankName": "Banco do Brasil",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 3. **Listar Todas as Solicitações** (Admin)
```
GET /api/wallet/withdrawal-requests?status=pending
Authorization: Bearer {admin_token}

Query Params:
- status (opcional): "pending", "approved", "rejected", "completed"

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "amount": 100.00,
      "status": "pending",
      "fullName": "João Silva",
      "cpf": "12345678909",
      "bankName": "Banco do Brasil",
      "agency": "1234",
      "account": "12345-6",
      "accountType": "checking",
      "user": {
        "id": "user_uuid",
        "name": "João Silva",
        "email": "joao@example.com",
        "balance": 500.00
      },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 4. **Aprovar Solicitação** (Admin)
```
PUT /api/wallet/withdrawal-requests/:id/approve
Authorization: Bearer {admin_token}

Body (opcional):
{
  "adminNotes": "Aprovado após verificação dos dados"
}

Response:
{
  "success": true,
  "message": "Solicitação aprovada com sucesso"
}
```

### 5. **Rejeitar Solicitação** (Admin)
```
PUT /api/wallet/withdrawal-requests/:id/reject
Authorization: Bearer {admin_token}

Body:
{
  "adminNotes": "Dados bancários inválidos" // Obrigatório
}

Response:
{
  "success": true,
  "message": "Solicitação rejeitada"
}
```

### 6. **Completar Saque** (Admin)
```
PUT /api/wallet/withdrawal-requests/:id/complete
Authorization: Bearer {admin_token}

Response:
{
  "success": true,
  "message": "Saque processado com sucesso"
}
```

**⚠️ IMPORTANTE:** Este endpoint:
- Só funciona se status = "approved"
- Debita o valor da carteira do usuário
- Cria uma transação de saque
- Atualiza `total_withdrawn` do usuário

## 🔐 Segurança e Permissões

### Campo `isAdmin` no User

Para tornar um usuário administrador, execute no banco:

```sql
UPDATE users SET isAdmin = TRUE WHERE email = 'admin@example.com';
```

Ou via Prisma:

```typescript
await prisma.user.update({
  where: { email: 'admin@example.com' },
  data: { isAdmin: true }
});
```

### Validações

1. **Criar Solicitação:**
   - ✅ Usuário autenticado
   - ✅ Saldo suficiente
   - ✅ Valor mínimo: R$ 1,00
   - ✅ Todos os dados bancários obrigatórios
   - ✅ CPF válido (11 dígitos)

2. **Aprovar/Rejeitar/Completar:**
   - ✅ Usuário autenticado
   - ✅ Usuário é admin (`isAdmin = true`)
   - ✅ Solicitação existe
   - ✅ Solicitação está em status válido

3. **Completar Saque:**
   - ✅ Status = "approved"
   - ✅ Usuário ainda tem saldo suficiente

## 📝 Status da Solicitação

| Status | Descrição | Ações Possíveis |
|--------|-----------|-----------------|
| `pending` | Aguardando análise do admin | Aprovar, Rejeitar |
| `approved` | Aprovado pelo admin | Completar |
| `rejected` | Rejeitado pelo admin | Nenhuma |
| `completed` | Saque processado | Nenhuma |

## 🔄 Fluxo Completo de Exemplo

1. **Usuário cria solicitação:**
   ```bash
   POST /api/wallet/withdraw
   # Status: "pending"
   # Saldo: NÃO debitado
   ```

2. **Admin aprova:**
   ```bash
   PUT /api/wallet/withdrawal-requests/:id/approve
   # Status: "approved"
   # Saldo: AINDA NÃO debitado
   ```

3. **Admin processa saque:**
   ```bash
   PUT /api/wallet/withdrawal-requests/:id/complete
   # Status: "completed"
   # Saldo: DEBITADO
   # Transação criada
   ```

## 🚀 Próximos Passos

Para implementar uma interface admin, você pode:

1. Criar uma tela web/admin para listar solicitações
2. Adicionar filtros por status
3. Adicionar busca por usuário/CPF
4. Adicionar exportação de relatórios
5. Adicionar notificações quando status mudar

## 📚 Migrations

Execute a migration SQL para criar as tabelas:

```bash
mysql -u usuario -p nome_do_banco < migrations/add_withdrawal_requests.sql
```

Ou via Prisma:

```bash
npx prisma migrate dev --name add_withdrawal_requests
```

