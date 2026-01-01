# 🔧 Correção: Adicionar campos PIX na tabela withdrawal_requests

## ❌ Erro
```
The column `withdrawalType` does not exist in the current database.
```

## ✅ Solução

Execute a migration SQL no seu banco de dados MySQL:

### Opção 1: Via MySQL CLI
```bash
mysql -u seu_usuario -p nome_do_banco < migrations/add_pix_fields_simple.sql
```

### Opção 2: Via MySQL Workbench ou phpMyAdmin
1. Abra o arquivo `migrations/add_pix_fields_simple.sql`
2. Copie e cole o conteúdo no editor SQL
3. Execute o script

### Opção 3: Via linha de comando MySQL
```sql
USE seu_banco_de_dados;

-- Adicionar campo withdrawalType
ALTER TABLE withdrawal_requests 
ADD COLUMN withdrawalType VARCHAR(20) DEFAULT 'bank' COMMENT 'bank ou pix';

-- Tornar campos bancários opcionais
ALTER TABLE withdrawal_requests 
MODIFY COLUMN bankName VARCHAR(255) NULL,
MODIFY COLUMN agency VARCHAR(50) NULL,
MODIFY COLUMN account VARCHAR(50) NULL,
MODIFY COLUMN accountType VARCHAR(20) NULL;

-- Adicionar campos PIX
ALTER TABLE withdrawal_requests 
ADD COLUMN pixKeyType VARCHAR(20) NULL COMMENT 'cpf, email, phone, random';

ALTER TABLE withdrawal_requests 
ADD COLUMN pixKey VARCHAR(255) NULL;
```

## ⚠️ Nota
Se alguma coluna já existir, você receberá um erro. Nesse caso, pode ignorar aquele comando específico e continuar com os próximos.

## ✅ Verificação
Após executar, verifique se as colunas foram criadas:
```sql
DESCRIBE withdrawal_requests;
```

Você deve ver as seguintes colunas:
- `withdrawalType`
- `pixKeyType`
- `pixKey`

