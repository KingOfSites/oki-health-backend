// PDF (Maio/2026 #8): taxa administrativa fixa cobrada pela Oki Health
// sobre todo pagamento realizado pelo usuário ao ingressar em um desafio.
// O valor cheio segue sendo cobrado do usuário; a parcela referente à taxa
// pertence à empresa, os demais 75% formam o pool de prêmios.
export const ADMIN_FEE_RATE = 0.25;

export type FeeBreakdown = {
  totalCents: number;
  feeCents: number;
  netCents: number;
};

export function computeAdminFeeBreakdown(totalCents: number): FeeBreakdown {
  const total = Math.max(0, Math.round(totalCents || 0));
  const feeCents = Math.round(total * ADMIN_FEE_RATE);
  const netCents = total - feeCents;
  return { totalCents: total, feeCents, netCents };
}

export function computeAdminFeeFromReais(amountReais: number): {
  totalReais: number;
  feeReais: number;
  netReais: number;
} {
  const { totalCents, feeCents, netCents } = computeAdminFeeBreakdown(
    Math.round((amountReais || 0) * 100),
  );
  return {
    totalReais: totalCents / 100,
    feeReais: feeCents / 100,
    netReais: netCents / 100,
  };
}
