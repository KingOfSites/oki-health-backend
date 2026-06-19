// Detalhe completo: estado de cada participação ativa do usuário,
// incluindo datas/horários para entender por que pode estar bloqueado
// envio de fotos.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "gui@gmail.com").trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(`❌ Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const participations = await prisma.challengeParticipant.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      joinedAt: true,
      points: true,
      challenge: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          startTime: true,
          endTime: true,
          status: true,
          createdById: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  console.log(`👤 ${user.email} — id ${user.id}`);
  console.log(`🎯 ${participations.length} participação(ões) ativa(s):\n`);

  const now = new Date();
  console.log(`⏰ Agora: ${now.toISOString()}\n`);

  for (const p of participations) {
    const c = p.challenge;
    const isCreator = c.createdById === user.id;
    const startUtc = new Date(c.startDate);
    const endUtc = new Date(c.endDate);
    const startOfStartDay = new Date(
      startUtc.getUTCFullYear(),
      startUtc.getUTCMonth(),
      startUtc.getUTCDate(),
      0, 0, 0, 0,
    );
    const endOfEndDay = new Date(
      endUtc.getUTCFullYear(),
      endUtc.getUTCMonth(),
      endUtc.getUTCDate(),
      23, 59, 59, 999,
    );
    if (c.endTime && /^\d{2}:\d{2}$/.test(c.endTime)) {
      const [h, m] = c.endTime.split(":");
      endOfEndDay.setHours(Number(h), Number(m), 59, 999);
    }
    const beforeStart = now < startOfStartDay;
    const afterEnd = now > endOfEndDay;
    const sendingAllowed = !beforeStart && !afterEnd && c.status !== "cancelled" && c.status !== "completed";
    const canUploadMedia = !isCreator && sendingAllowed;

    console.log(`━━━ "${c.title}" (${c.id})`);
    console.log(`    status:               ${c.status || "(null/active)"}`);
    console.log(`    é o criador:           ${isCreator ? "❌ SIM (bloqueia upload)" : "✅ NÃO"}`);
    console.log(`    startDate:            ${c.startDate.toISOString()}`);
    console.log(`    endDate:              ${c.endDate.toISOString()}`);
    console.log(`    startTime/endTime:    ${c.startTime || "(null)"} / ${c.endTime || "(null)"}`);
    console.log(`    startOfStartDay UTC:  ${startOfStartDay.toISOString()}`);
    console.log(`    endOfEndDay UTC:      ${endOfEndDay.toISOString()}`);
    console.log(`    desafio começou?       ${!beforeStart ? "✅" : "❌ ainda não começou"}`);
    console.log(`    desafio terminou?      ${afterEnd ? "❌ JÁ TERMINOU" : "✅ ainda em curso"}`);
    console.log(`    sendingAllowed?        ${sendingAllowed ? "✅" : "❌"}`);
    console.log(`    ▶ canUploadMedia?      ${canUploadMedia ? "✅ DEVERIA FUNCIONAR" : "❌ BLOQUEADO"}`);
    console.log("");
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
