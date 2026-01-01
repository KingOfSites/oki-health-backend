-- Migration para adicionar campos de PIX na tabela withdrawal_requests
-- Execute este script no seu banco de dados MySQL

-- Adicionar campo withdrawalType (se não existir)
-- Se der erro dizendo que a coluna já existe, ignore e continue
ALTER TABLE withdrawal_requests 
ADD COLUMN withdrawalType VARCHAR(20) DEFAULT 'bank' COMMENT 'bank ou pix';

-- Tornar campos bancários opcionais
ALTER TABLE withdrawal_requests 
MODIFY COLUMN bankName VARCHAR(255) NULL,
MODIFY COLUMN agency VARCHAR(50) NULL,
MODIFY COLUMN account VARCHAR(50) NULL,
MODIFY COLUMN accountType VARCHAR(20) NULL;

-- Adicionar campos PIX (se não existirem)
-- Se der erro dizendo que a coluna já existe, ignore e continue
ALTER TABLE withdrawal_requests 
ADD COLUMN pixKeyType VARCHAR(20) NULL COMMENT 'cpf, email, phone, random';

ALTER TABLE withdrawal_requests 
ADD COLUMN pixKey VARCHAR(255) NULL;
