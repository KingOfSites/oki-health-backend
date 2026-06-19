-- OKI 26/05/2026 #2 (V2): campos para rastrear o ciclo de vida do
-- PIX Out automático via Mercado Pago. Quando MP_PAYOUT_ENABLED=true,
-- approveWithdrawalRequest dispara o PIX e o webhook fecha o saque.
--
-- mpPayoutId         — id do payout retornado pela API do MP
-- mpPayoutStatus     — pending | processing | approved | rejected | failed
-- mpPayoutError      — mensagem de erro caso a chamada falhe
-- payoutAttemptedAt  — quando a API foi chamada pela primeira vez
-- payoutCompletedAt  — quando o webhook confirmou o PIX

ALTER TABLE withdrawal_requests
  ADD COLUMN mpPayoutId        VARCHAR(64)  NULL AFTER processedBy,
  ADD COLUMN mpPayoutStatus    VARCHAR(32)  NULL AFTER mpPayoutId,
  ADD COLUMN mpPayoutError     TEXT         NULL AFTER mpPayoutStatus,
  ADD COLUMN payoutAttemptedAt DATETIME     NULL AFTER mpPayoutError,
  ADD COLUMN payoutCompletedAt DATETIME     NULL AFTER payoutAttemptedAt;

CREATE INDEX idx_withdrawal_mp_payout_id     ON withdrawal_requests (mpPayoutId);
CREATE INDEX idx_withdrawal_mp_payout_status ON withdrawal_requests (mpPayoutStatus);
