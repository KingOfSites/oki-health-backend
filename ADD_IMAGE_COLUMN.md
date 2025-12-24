# Adicionar coluna imageUrl ao banco de dados

## ⚠️ IMPORTANTE: Execute este SQL no seu banco de dados

O campo `imageUrl` está temporariamente comentado no schema do Prisma para evitar erros. Para habilitar o upload de imagens, siga estes passos:

### Passo 1: Adicionar a coluna no banco

Execute o seguinte comando SQL no seu banco de dados MySQL:

```sql
ALTER TABLE challenge_chat ADD COLUMN imageUrl VARCHAR(500) NULL;
```

Você pode executar via:
- Prisma Studio: `npx prisma studio` (depois vá em "Add column")
- MySQL Workbench
- Qualquer cliente MySQL
- Ou via terminal: `mysql -u seu_usuario -p sua_database < add_image_column.sql`

### Passo 2: Descomentar o campo no schema

Após adicionar a coluna no banco, edite `prisma/schema.prisma` e descomente a linha:

```prisma
imageUrl    String?
```

Remova o comentário `//` antes de `imageUrl`.

### Passo 3: Regenerar Prisma Client

Após descomentar no schema, execute:

```bash
cd oki-health-backend
npx prisma generate
```

Isso irá regenerar o Prisma Client com o novo campo.

### Nota

O código já está preparado para funcionar mesmo sem o campo (usando SQL raw), mas para funcionalidade completa de upload de imagens, você precisa:
1. Adicionar a coluna no banco
2. Descomentar no schema
3. Regenerar o Prisma Client

