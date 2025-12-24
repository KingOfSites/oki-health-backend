# Migration: Adicionar campo `isPro` na tabela `users`

## ✅ Esta migration é 100% SEGURA - NÃO causa perda de dados

Esta migration apenas **ADICIONA** um novo campo `isPro` na tabela `users` sem modificar ou remover nenhum dado existente.

## 📋 O que esta migration faz:

1. ✅ Adiciona o campo `isPro BOOLEAN DEFAULT false` na tabela `users`
2. ✅ Atualiza usuários existentes que têm assinatura ativa para `isPro = true`
3. ✅ Não remove nenhum campo existente
4. ✅ Não modifica dados existentes (apenas adiciona)

## 🚀 Como aplicar:

### Opção 1: Executar SQL diretamente no banco (RECOMENDADO)

Execute o script SQL diretamente no seu banco de dados MySQL:

```bash
# O arquivo está em: oki-health-backend/scripts/apply_ispro_migration.sql
```

Ou execute este SQL no seu cliente MySQL:

```sql
-- Adicionar campo isPro
ALTER TABLE `users` 
ADD COLUMN `isPro` BOOLEAN NOT NULL DEFAULT false;

-- Atualizar usuários existentes com assinatura ativa
UPDATE `users` u
INNER JOIN `plan_subscriptions` ps ON u.id = ps.userId
SET u.isPro = TRUE
WHERE ps.active = TRUE 
  AND (ps.endDate IS NULL OR ps.endDate >= NOW())
  AND u.isPro = FALSE;
```

### Opção 2: Usar Prisma Migrate Deploy

Se você já executou o SQL manualmente, marque a migration como aplicada:

```bash
cd oki-health-backend
npx prisma migrate resolve --applied 20241220120000_add_ispro_to_user
```

Depois, gere o Prisma Client atualizado:

```bash
npx prisma generate
```

## ✅ Verificação

Após aplicar a migration, verifique se funcionou:

```sql
-- Verificar se a coluna foi criada
DESCRIBE users;

-- Verificar quantos usuários são PRO
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN isPro = TRUE THEN 1 ELSE 0 END) as pro_users,
    SUM(CASE WHEN isPro = FALSE THEN 1 ELSE 0 END) as free_users
FROM users;
```

## 🔒 Segurança

- ✅ Esta migration **NÃO** remove campos
- ✅ Esta migration **NÃO** modifica dados existentes
- ✅ Esta migration **NÃO** altera estrutura de outras tabelas
- ✅ Esta migration **APENAS ADICIONA** um novo campo com valor padrão `false`

