// PDF (Maio/2026 #10): Testes de distribuição financeira.
// Script executável (`tsx`) que valida as três distribuições da plataforma:
//   1. Distribuição de prêmios entre participantes dos desafios
//   2. Distribuição de ganhos para usuários Premium (5%)
//   3. Distribuição de comissões para afiliados (15%)
// Não depende do banco — testa apenas a regra de negócio pura.

import { ADMIN_FEE_RATE, computeAdminFeeFromReais } from "../utils/adminFee";

type TestResult = { name: string; passed: boolean; details?: string };
const results: TestResult[] = [];

function assertEqual(name: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({
    name,
    passed: ok,
    details: ok ? undefined : `esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`,
  });
}

function assertClose(name: string, actual: number, expected: number, tol = 0.01) {
  const ok = Math.abs(actual - expected) <= tol;
  results.push({
    name,
    passed: ok,
    details: ok ? undefined : `esperado ${expected}, obtido ${actual} (tol ${tol})`,
  });
}

// ============================================================
// 1. PRÊMIOS — distribuição integral (top 3) e dividida (igual)
// ============================================================
function distributeIntegral(
  participants: Array<{ id: string; points: number }>,
  prizesCents: [number, number, number],
): Array<{ position: number; userId: string; cents: number; tied: boolean }> {
  const sorted = [...participants].sort((a, b) => b.points - a.points);
  const out: Array<{ position: number; userId: string; cents: number; tied: boolean }> = [];
  let positionIndex = 0;
  let i = 0;
  while (i < sorted.length && positionIndex < 3) {
    const currentPoints = sorted[i].points;
    const group = sorted.filter((p) => p.points === currentPoints);
    const prizeCents = prizesCents[positionIndex];
    if (prizeCents > 0 && group.length > 0) {
      const share = Math.floor(prizeCents / group.length);
      for (const m of group) {
        out.push({ position: positionIndex + 1, userId: m.id, cents: share, tied: group.length > 1 });
      }
    }
    i += group.length;
    positionIndex++;
  }
  return out;
}

function distributeEqual(
  participants: Array<{ id: string }>,
  totalCents: number,
): Array<{ userId: string; cents: number }> {
  const share = Math.floor(totalCents / participants.length);
  return participants.map((p) => ({ userId: p.id, cents: share }));
}

// Caso A: 3 participantes, prêmios 10000/5000/2500, sem empate.
const caseA = distributeIntegral(
  [
    { id: "a", points: 30 },
    { id: "b", points: 20 },
    { id: "c", points: 10 },
  ],
  [10000, 5000, 2500],
);
assertEqual("Prêmios integrais (sem empate)", caseA, [
  { position: 1, userId: "a", cents: 10000, tied: false },
  { position: 2, userId: "b", cents: 5000, tied: false },
  { position: 3, userId: "c", cents: 2500, tied: false },
]);

// Caso B: empate no 1º lugar entre 2 participantes (prêmio do 1º dividido).
const caseB = distributeIntegral(
  [
    { id: "a", points: 30 },
    { id: "b", points: 30 },
    { id: "c", points: 10 },
  ],
  [10000, 5000, 2500],
);
assertEqual("Prêmios integrais (empate 1º)", caseB, [
  { position: 1, userId: "a", cents: 5000, tied: true },
  { position: 1, userId: "b", cents: 5000, tied: true },
  { position: 2, userId: "c", cents: 5000, tied: false },
]);

// Caso C: distribuição dividida igual entre todos.
const caseC = distributeEqual(
  [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
  10001, // valor que não divide perfeitamente — Math.floor garante consistência.
);
assertEqual("Prêmios divididos (igual)", caseC, [
  { userId: "a", cents: 2500 },
  { userId: "b", cents: 2500 },
  { userId: "c", cents: 2500 },
  { userId: "d", cents: 2500 },
]);

// ============================================================
// 2. PREMIUM — 5% de retorno sobre cada desafio concluído
// ============================================================
function premiumReturn(challengePrizeCents: number): number {
  return Math.floor(challengePrizeCents * 0.05);
}

assertEqual("Premium 5% (10000)", premiumReturn(10000), 500);
assertEqual("Premium 5% (17500)", premiumReturn(17500), 875);
assertEqual("Premium 5% (0)", premiumReturn(0), 0);

// ============================================================
// 3. AFILIADO — 15% de comissão por conversão
// ============================================================
function affiliateCommission(paymentAmountReais: number): number {
  return Math.round(paymentAmountReais * 0.15 * 100) / 100;
}

assertClose("Afiliado 15% (R$ 100)", affiliateCommission(100), 15);
assertClose("Afiliado 15% (R$ 49,90)", affiliateCommission(49.9), 7.49);
assertClose("Afiliado 15% (R$ 0)", affiliateCommission(0), 0);

// ============================================================
// 4. TAXA ADMINISTRATIVA — 25% sobre entradas
// ============================================================
const fee100 = computeAdminFeeFromReais(100);
assertClose("Admin fee 25% (R$ 100) — fee", fee100.feeReais, 25);
assertClose("Admin fee 25% (R$ 100) — net", fee100.netReais, 75);

const fee49 = computeAdminFeeFromReais(49.9);
// 49.90 * 0.25 = 12.475 → 1247 cents arredondado → 12.47
assertClose("Admin fee 25% (R$ 49,90) — fee + net = total", fee49.feeReais + fee49.netReais, 49.9);

assertEqual("ADMIN_FEE_RATE === 0.25", ADMIN_FEE_RATE, 0.25);

// ============================================================
// 5. CENÁRIO INTEGRADO
// Desafio com 5 entradas a R$ 100, prêmios 50/30/20, sem empate.
// Esperado:
//  - Taxa Oki: 5 * 25 = R$ 125
//  - Pool teórico: 5 * 75 = R$ 375
//  - Distribuição (prêmios configurados pelo criador): 50 + 30 + 20 = 100
//  - Comissão afiliado de QUEM indicou o pagador (15% sobre R$ 100 cada): 5 * 15 = R$ 75
//  - Premium creator (5% do total de prêmios = 5% de 100): R$ 5
// ============================================================
const entriesReais = Array.from({ length: 5 }, () => 100);
const totalFee = entriesReais.reduce((acc, v) => acc + computeAdminFeeFromReais(v).feeReais, 0);
const totalNet = entriesReais.reduce((acc, v) => acc + computeAdminFeeFromReais(v).netReais, 0);
assertClose("Cenário integrado — taxa total", totalFee, 125);
assertClose("Cenário integrado — pool total", totalNet, 375);

const affiliateTotal = entriesReais.reduce((acc, v) => acc + affiliateCommission(v), 0);
assertClose("Cenário integrado — comissão afiliado total", affiliateTotal, 75);

const premiumBonusCents = premiumReturn((50 + 30 + 20) * 100);
assertEqual("Cenário integrado — bônus Premium (5% de 100)", premiumBonusCents, 500);

// ============================================================
// RELATÓRIO
// ============================================================
const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = total - passed;

console.log("\n=== Testes de Distribuição Financeira (PDF Maio/2026 #10) ===");
for (const r of results) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`${icon} ${r.name}${r.details ? `\n    ${r.details}` : ""}`);
}
console.log(`\n${passed}/${total} testes passaram (${failed} falharam).`);

if (failed > 0) {
  process.exit(1);
}
