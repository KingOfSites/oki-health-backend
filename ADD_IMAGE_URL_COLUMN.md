# Adicionar coluna imageUrl ao banco de dados

## Passos para adicionar a coluna imageUrl na tabela challenge_chat

### 1. Execute o SQL no banco de dados

Execute o seguinte comando SQL no seu banco de dados MySQL:

```sql
ALTER TABLE challenge_chat ADD COLUMN imageUrl VARCHAR(500) NULL;
```

Você pode executar via:
- **Prisma Studio**: `npx prisma studio` (depois vá na tabela challenge_chat e adicione a coluna manualmente)
- **MySQL Workbench**
- **Qualquer cliente MySQL**
- **Terminal MySQL**: 
  ```bash
  mysql -u seu_usuario -p sua_database < add_image_column.sql
  ```

### 2. Regenerar Prisma Client

Após adicionar a coluna no banco, execute:

```bash
cd oki-health-backend
npx prisma generate
```

Isso irá regenerar o Prisma Client com o novo campo `imageUrl`.

### 3. Reiniciar o servidor

Após regenerar o Prisma Client, reinicie o servidor backend:

```bash
npm run dev
```

## Verificação

Após seguir os passos acima:
- ✅ A coluna `imageUrl` estará disponível no banco de dados
- ✅ O Prisma Client terá o campo `imageUrl` disponível
- ✅ As imagens enviadas no chat serão salvas no banco
- ✅ As imagens aparecerão para todos os usuários no chat

## Nota

O código já está preparado para funcionar com a coluna `imageUrl`. Após adicionar a coluna e regenerar o Prisma Client, tudo funcionará automaticamente.

