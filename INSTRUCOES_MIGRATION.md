# 🔧 Instruções para Executar a Migration

## ❌ Problema Atual

O Prisma está dando erro: `Unknown argument 'isPublic'` e `Unknown argument 'frequency'`.

Isso acontece porque:
1. Os campos foram adicionados ao schema do Prisma (`schema.prisma`)
2. Mas a migration SQL ainda não foi executada no banco de dados
3. E o Prisma Client não foi regenerado

## ✅ Solução

### Opção 1: Executar SQL Manualmente (RECOMENDADO)

1. **Abra seu cliente MySQL** (MySQL Workbench, phpMyAdmin, DBeaver, etc.)

2. **Conecte-se ao banco de dados:**
   - Host: `217.196.51.2`
   - Porta: `3310`
   - Usuário: `root`
   - Senha: `Ujaifhnfoeunroginen81u3ni`
   - Banco: `oki_health`

3. **Execute o arquivo SQL:**
   - Abra o arquivo `EXECUTAR_MIGRATION.sql`
   - Copie e cole o conteúdo no seu cliente MySQL
   - Execute o script

   **OU** execute diretamente estes comandos:

```sql
ALTER TABLE `challenges` 
ADD COLUMN `isPublic` BOOLEAN DEFAULT TRUE COMMENT 'Visibilidade do desafio: true = Público, false = Privado',
ADD COLUMN `frequency` VARCHAR(20) DEFAULT 'daily' COMMENT 'Frequência de registros: daily, weekly, custom';

UPDATE `challenges` SET `isPublic` = TRUE WHERE `isPublic` IS NULL;
UPDATE `challenges` SET `frequency` = 'daily' WHERE `frequency` IS NULL;
```

4. **Regenere o Prisma Client:**
   ```bash
   cd oki-health-backend
   npx prisma generate
   ```

5. **Reinicie o backend:**
   ```bash
   npm run dev
   ```

### Opção 2: Usar Linha de Comando MySQL

Se você tem o MySQL CLI instalado:

```bash
mysql -h 217.196.51.2 -P 3310 -u root -p oki_health < EXECUTAR_MIGRATION.sql
```

Quando solicitado, digite a senha: `Ujaifhnfoeunroginen81u3ni`

### Opção 3: Usar Prisma Migrate (se conexão funcionar)

Se conseguir resolver o problema de conexão do Prisma:

```bash
cd oki-health-backend
npx prisma migrate dev --name add_isPublic_frequency
npx prisma generate
```

## 🔍 Verificar se Funcionou

Após executar a migration, verifique se as colunas foram criadas:

```sql
DESCRIBE challenges;
```

Você deve ver as colunas `isPublic` e `frequency` na lista.

## ⚠️ Importante

- Se as colunas já existirem, o script SQL não dará erro (usa IF para verificar)
- Após executar a migration, **sempre** execute `npx prisma generate` para regenerar o Prisma Client
- Reinicie o backend após regenerar o Prisma Client
