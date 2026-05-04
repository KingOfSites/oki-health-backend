import prisma from "../config/database";
import { v4 as uuidv4 } from "uuid";
import { parseWeeklyGoal } from "../services/challenges.service";

// Simulando um banco de dados de 70+ mensagens separadas por horário
const messages = {
  morning: [
    "Bom dia! Que tal começar o dia com um copo de água?",
    "Aproveite a manhã para se alongar e focar no seu bem-estar.",
    "Café da manhã é essencial! Escolha opções saudáveis.",
    "Um bom dia começa com uma atitude positiva!",
    "Planeje suas refeições do dia hoje mesmo.",
    // Adicionar até 70 mensagens depois
  ],
  afternoon: [
    "Boa tarde! Já bateu sua meta de água hoje?",
    "Uma pausa para respirar fundo faz toda a diferença.",
    "Mantenha o foco! A tarde é ótima para um pequeno alongamento.",
    "Escolha um lanche saudável para a tarde.",
    "Você está indo muito bem, continue firme no seu desafio!",
    // Adicionar até 70 mensagens depois
  ],
  evening: [
    "Boa noite! Lembre-se de registrar suas atividades de hoje.",
    "Hora de desacelerar. Evite telas 1h antes de dormir.",
    "Como foi o seu dia? Registre seu progresso!",
    "Um jantar leve ajuda na qualidade do sono.",
    "Parabéns por hoje! Descanse bem para amanhã.",
    // Adicionar até 70 mensagens depois
  ]
};

// Variável para manter o controle de quais horas já enviamos hoje
let lastSentHour = -1;
let lastSentDay = -1;
let lastWeeklyDigestDay = -1;

// PDF #12: o ciclo semanal (7 dias) é contabilizado a partir da data de
// início do desafio, não do calendário civil. Esta função retorna o
// índice da semana atual (0-based) e a janela [startOfWeek, endOfWeek)
// correspondente ao período em que o usuário deve atingir a meta.
export function computeChallengeWeekWindow(startDate: Date, reference: Date = new Date()) {
  const start = new Date(startDate);
  const startMs = start.getTime();
  const refMs = reference.getTime();
  if (Number.isNaN(startMs) || refMs < startMs) {
    return null;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const weekIndex = Math.floor((refMs - startMs) / (7 * dayMs));
  const startOfWeek = new Date(startMs + weekIndex * 7 * dayMs);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * dayMs);
  return { weekIndex, startOfWeek, endOfWeek };
}

// PDF #11: dispara, uma vez por dia, uma notificação para cada participante
// ativo informando quantos registros ainda faltam para bater a meta semanal
// definida no desafio. Considera o ciclo semanal a partir do início (#12).
async function sendWeeklyProgressNotifications() {
  try {
    const now = new Date();
    const challenges = await prisma.challenge.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        status: { not: "cancelled" },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        frequency: true,
      },
    });

    let totalSent = 0;

    for (const challenge of challenges) {
      const weeklyGoal = parseWeeklyGoal(challenge.frequency);
      if (!weeklyGoal) continue;

      const window = computeChallengeWeekWindow(challenge.startDate, now);
      if (!window) continue;

      const participants = await prisma.challengeParticipant.findMany({
        where: { challengeId: challenge.id },
        select: { userId: true },
      });
      if (participants.length === 0) continue;

      for (const { userId } of participants) {
        const verifiedThisWeek = await prisma.challengeChat.count({
          where: {
            challengeId: challenge.id,
            userId,
            verificationStatus: "verified",
            verifiedAt: {
              gte: window.startOfWeek,
              lt: window.endOfWeek,
            },
          },
        });

        const remaining = Math.max(0, weeklyGoal - verifiedThisWeek);
        if (remaining === 0) continue;

        await prisma.notification.create({
          data: {
            id: uuidv4(),
            userId,
            challengeId: challenge.id,
            title: `Meta semanal — ${challenge.title}`,
            body: `Você tem ${remaining} ${remaining === 1 ? "registro" : "registros"} restantes para bater a meta da semana (${weeklyGoal}/semana).`,
            type: "weekly_progress",
          },
        });
        totalSent += 1;
      }
    }

    if (totalSent > 0) {
      console.log(`[Notification Engine] ${totalSent} alertas de meta semanal enviados.`);
    }
  } catch (error) {
    console.error("[Notification Engine] Erro ao enviar progresso semanal:", error);
  }
}

export const startNotificationEngine = () => {
  console.log("⏰ Notification Engine iniciada (verificação a cada minuto)");

  // Roda a cada 60 segundos
  setInterval(async () => {
    const now = new Date();
    const actHour = now.getHours();
    const actDay = now.getDate();

    // Reseta o controle diário se mudou de dia
    if (actDay !== lastSentDay) {
      lastSentHour = -1;
      lastSentDay = actDay;
    }

    // Queremos enviar notificações às 9:00, 15:00 e 20:00 (por exemplo)
    const scheduledHours = [9, 15, 20];
    const isScheduledHour = scheduledHours.includes(actHour);

    // Se é uma hora agendada e ainda não enviamos nessa hora de hoje
    if (isScheduledHour && lastSentHour !== actHour) {
      console.log(`[Notification Engine] Disparando notificações para a hora ${actHour}:00...`);
      lastSentHour = actHour; // Marca como enviado

      try {
        let periodKey: "morning" | "afternoon" | "evening" = "morning";
        if (actHour === 15) periodKey = "afternoon";
        if (actHour === 20) periodKey = "evening";

        const periodMessages = messages[periodKey];
        // Seleciona uma mensagem aleatória das disponíveis
        const randomMessage = periodMessages[Math.floor(Math.random() * periodMessages.length)];

        // Busca usuários que têm notificações ativadas
        const users = await prisma.user.findMany({
          where: { notifications: true },
          select: { id: true }
        });

        console.log(`[Notification Engine] Encontrou ${users.length} usuários para notificar.`);

        if (users.length > 0) {
          // Cria registros no banco "notifications" para esses usuários
          const notificationsData = users.map(user => ({
            id: uuidv4(),
            userId: user.id,
            title: "Dica Oki Health 🌿",
            body: randomMessage,
            type: "general"
          }));

          await prisma.notification.createMany({
            data: notificationsData,
            skipDuplicates: true
          });

          console.log(`[Notification Engine] ${notificationsData.length} notificações criadas com sucesso.`);
          // Em um passo futuro, aqui também seria chamado o Firebase Admin `admin.messaging().sendMulticast(...)`
          // caso a tabela User possuísse os tokens FCM (ex: fcmToken).
        }
      } catch (error) {
        console.error("[Notification Engine] Erro ao disparar notificações:", error);
      }
    }

    // PDF #11: alerta diário de progresso semanal (uma vez por dia, 19h).
    if (actHour === 19 && lastWeeklyDigestDay !== actDay) {
      lastWeeklyDigestDay = actDay;
      await sendWeeklyProgressNotifications();
    }
  }, 60 * 1000); // 1 minuto
};
