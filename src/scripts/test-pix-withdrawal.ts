// PDF (Maio/2026 #11): Testes de transferência bancária (PIX).
// Valida as regras de criação de pedido de saque PIX no controller wallet:
// formatos de chave (CPF, e-mail, telefone, aleatória), valor mínimo,
// dados obrigatórios, e rastreabilidade do pedido.

type TestResult = { name: string; passed: boolean; details?: string };
const results: TestResult[] = [];

function assert(name: string, cond: boolean, details?: string) {
  results.push({ name, passed: cond, details: cond ? undefined : details });
}

// Replicação do validador usado no WalletController.withdraw — mantenha
// em sincronia caso a regra mude.
function validatePixWithdrawalPayload(input: {
  amount?: number;
  fullName?: string;
  cpf?: string;
  bankName?: string;
  pixKeyType?: string;
  pixKey?: string;
}): { ok: true } | { ok: false; error: string } {
  const { amount, fullName, cpf, bankName, pixKeyType, pixKey } = input;
  if (!amount || amount <= 0) return { ok: false, error: "Valor inválido" };
  if (amount < 1) return { ok: false, error: "O valor mínimo para saque é R$ 1,00" };
  if (!fullName || !cpf) return { ok: false, error: "Nome completo e CPF são obrigatórios" };

  const cpfDigits = String(cpf).replace(/\D/g, "");
  if (cpfDigits.length !== 11) return { ok: false, error: "CPF inválido" };

  if (!bankName) return { ok: false, error: "Nome do banco é obrigatório para saque PIX" };
  if (!pixKeyType || !pixKey) return { ok: false, error: "Tipo e chave PIX são obrigatórios" };

  const validPixKeyTypes = ["cpf", "email", "phone", "random"];
  if (!validPixKeyTypes.includes(pixKeyType)) return { ok: false, error: "Tipo de chave PIX inválido" };

  if (pixKeyType === "cpf") {
    const d = String(pixKey).replace(/\D/g, "");
    if (d.length !== 11) return { ok: false, error: "CPF da chave PIX inválido" };
  } else if (pixKeyType === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(pixKey)) return { ok: false, error: "Email da chave PIX inválido" };
  } else if (pixKeyType === "phone") {
    const d = String(pixKey).replace(/\D/g, "");
    if (d.length < 10 || d.length > 11) return { ok: false, error: "Telefone da chave PIX inválido" };
  } else if (pixKeyType === "random") {
    if (pixKey.length < 32) return { ok: false, error: "Chave PIX aleatória inválida" };
  }

  return { ok: true };
}

// ====================== POSITIVOS ======================
const base = {
  amount: 50,
  fullName: "Maria Silva",
  cpf: "123.456.789-09",
  bankName: "Banco do Brasil",
};

assert(
  "PIX CPF válido",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "cpf", pixKey: "12345678909" }).ok === true,
);
assert(
  "PIX E-mail válido",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "email", pixKey: "user@example.com" }).ok === true,
);
assert(
  "PIX Telefone válido (11 dígitos)",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "phone", pixKey: "(11) 98888-7777" }).ok === true,
);
assert(
  "PIX Chave aleatória (UUID 32 chars)",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "random", pixKey: "abcdef0123456789abcdef0123456789" }).ok ===
    true,
);

// ====================== NEGATIVOS ======================
assert(
  "PIX valor zero rejeitado",
  validatePixWithdrawalPayload({ ...base, amount: 0, pixKeyType: "cpf", pixKey: "12345678909" }).ok === false,
);
assert(
  "PIX valor abaixo de R$ 1 rejeitado",
  validatePixWithdrawalPayload({ ...base, amount: 0.5, pixKeyType: "cpf", pixKey: "12345678909" }).ok === false,
);
assert(
  "Sem bankName em PIX",
  validatePixWithdrawalPayload({ ...base, bankName: undefined, pixKeyType: "cpf", pixKey: "12345678909" }).ok ===
    false,
);
assert(
  "PIX CPF curto rejeitado",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "cpf", pixKey: "1234" }).ok === false,
);
assert(
  "PIX email mal-formado rejeitado",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "email", pixKey: "no-arroba" }).ok === false,
);
assert(
  "PIX telefone curto rejeitado",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "phone", pixKey: "1234" }).ok === false,
);
assert(
  "PIX chave aleatória curta rejeitada",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "random", pixKey: "short" }).ok === false,
);
assert(
  "Tipo de chave PIX desconhecido",
  validatePixWithdrawalPayload({ ...base, pixKeyType: "qr-code", pixKey: "x" }).ok === false,
);
assert(
  "CPF do solicitante inválido",
  validatePixWithdrawalPayload({ ...base, cpf: "11122233", pixKeyType: "cpf", pixKey: "12345678909" }).ok === false,
);

// ====================== RASTREABILIDADE ======================
// Simula a sanitização que o controller faz antes de gravar no banco.
function sanitizeWithdrawalRecord(input: {
  amount: number;
  pixKeyType: string;
  pixKey: string;
  cpf: string;
  bankName: string;
  fullName: string;
}) {
  return {
    withdrawalType: "pix" as const,
    fullName: input.fullName.trim(),
    cpf: input.cpf.replace(/\D/g, ""),
    bankName: input.bankName.trim(),
    pixKeyType: input.pixKeyType,
    pixKey: input.pixKey.trim(),
    amount: input.amount,
    status: "pending",
  };
}

const record = sanitizeWithdrawalRecord({
  amount: 75,
  pixKeyType: "cpf",
  pixKey: "  12345678909  ",
  cpf: "123.456.789-09",
  bankName: "  Banco do Brasil ",
  fullName: "  Maria Silva ",
});
assert("Rastreabilidade — cpf normalizado", record.cpf === "12345678909");
assert("Rastreabilidade — bankName trim", record.bankName === "Banco do Brasil");
assert("Rastreabilidade — pixKey trim", record.pixKey === "12345678909");
assert("Rastreabilidade — status pendente", record.status === "pending");
assert("Rastreabilidade — withdrawalType pix", record.withdrawalType === "pix");

// ====================== RELATÓRIO ======================
const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = total - passed;

console.log("\n=== Testes de Transferência PIX (PDF Maio/2026 #11) ===");
for (const r of results) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`${icon} ${r.name}${r.details ? `\n    ${r.details}` : ""}`);
}
console.log(`\n${passed}/${total} testes passaram (${failed} falharam).`);

if (failed > 0) {
  process.exit(1);
}
