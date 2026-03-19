-- Migration: Modo Balança, geolocalização, tipo de prêmio, recuperação de senha

-- User: campos de saúde para Modo Balança
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS medicationLast6Months TINYINT(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surgeryLast6Months    TINYINT(1) DEFAULT 0;

-- Challenge: modo, tipo de prêmio, geolocalização
ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS mode                  VARCHAR(20) DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS prizeDistributionType VARCHAR(20) DEFAULT 'integral',
  ADD COLUMN IF NOT EXISTS latitude              DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS longitude             DOUBLE NULL;

-- Tabela de tokens de recuperação de senha
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id        VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  userId    VARCHAR(36)  NOT NULL,
  token     VARCHAR(255) NOT NULL UNIQUE,
  expiresAt DATETIME     NOT NULL,
  used      TINYINT(1)   NOT NULL DEFAULT 0,
  createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_prt_userId (userId),
  INDEX idx_prt_token  (token)
);
