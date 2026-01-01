-- Migration para adicionar campos de PIX e withdrawalType
-- Execute este script se a tabela withdrawal_requests já existe sem esses campos

-- Verificar se a coluna withdrawalType não existe antes de adicionar
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'withdrawal_requests' 
               AND COLUMN_NAME = 'withdrawalType');

SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE withdrawal_requests ADD COLUMN withdrawalType VARCHAR(20) DEFAULT ''bank'' COMMENT ''bank ou pix''',
  'SELECT ''Column withdrawalType already exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Tornar campos bancários opcionais (se ainda não forem)
ALTER TABLE withdrawal_requests 
MODIFY COLUMN bankName VARCHAR(255) NULL,
MODIFY COLUMN agency VARCHAR(50) NULL,
MODIFY COLUMN account VARCHAR(50) NULL,
MODIFY COLUMN accountType VARCHAR(20) NULL;

-- Verificar se a coluna pixKeyType não existe antes de adicionar
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'withdrawal_requests' 
               AND COLUMN_NAME = 'pixKeyType');

SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE withdrawal_requests ADD COLUMN pixKeyType VARCHAR(20) NULL COMMENT ''cpf, email, phone, random''',
  'SELECT ''Column pixKeyType already exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar se a coluna pixKey não existe antes de adicionar
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'withdrawal_requests' 
               AND COLUMN_NAME = 'pixKey');

SET @sqlstmt := IF(@exist = 0, 
  'ALTER TABLE withdrawal_requests ADD COLUMN pixKey VARCHAR(255) NULL',
  'SELECT ''Column pixKey already exists'' AS message');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
