-- OKI 26/05/2026 — split na entrada via MP Marketplace.
-- Tabela pra guardar o access_token + refresh_token da conta Pool
-- (recebida via OAuth). O backend usa esse token pra criar pagamentos
-- com application_fee=25%, fazendo o MP dividir automaticamente:
--   25% (application_fee) → conta Oki principal
--   75% (transaction_amount líquido) → conta Pool
--
-- account_role: "pool" (pode ser estendido pra outros papéis depois).
-- expires_at: MP devolve access_token com expires_in=15552000s (~6m).
-- refresh_token: nunca expira, usado pra renovar antes de vencer.

CREATE TABLE IF NOT EXISTS mp_marketplace_credentials (
  id              VARCHAR(36)  PRIMARY KEY,
  account_role    VARCHAR(32)  NOT NULL,
  mp_user_id      VARCHAR(64)  NOT NULL,
  access_token    TEXT         NOT NULL,
  refresh_token   TEXT         NOT NULL,
  public_key      VARCHAR(255) NULL,
  scope           VARCHAR(255) NULL,
  expires_at      DATETIME     NOT NULL,
  last_refreshed_at DATETIME   NULL,
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mp_role (account_role),
  KEY idx_mp_user_id (mp_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
