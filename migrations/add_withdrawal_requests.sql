-- Adicionar campo isAdmin na tabela users
ALTER TABLE users 
ADD COLUMN isAdmin BOOLEAN DEFAULT FALSE;

-- Criar tabela de solicitações de saque
CREATE TABLE withdrawal_requests (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, approved, rejected, completed',
  withdrawalType VARCHAR(20) DEFAULT 'bank' COMMENT 'bank ou pix',
  fullName VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) NOT NULL,
  -- Dados bancários (quando withdrawalType = "bank")
  bankName VARCHAR(255) NULL,
  agency VARCHAR(50) NULL,
  account VARCHAR(50) NULL,
  accountType VARCHAR(20) NULL COMMENT 'checking ou savings',
  -- Dados PIX (quando withdrawalType = "pix")
  pixKeyType VARCHAR(20) NULL COMMENT 'cpf, email, phone, random',
  pixKey VARCHAR(255) NULL,
  adminNotes TEXT NULL COMMENT 'Notas do admin ao processar',
  processedAt DATETIME NULL,
  processedBy VARCHAR(36) NULL COMMENT 'ID do admin que processou',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

