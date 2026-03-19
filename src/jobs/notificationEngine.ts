import prisma from "../config/database";
import { v4 as uuidv4 } from "uuid";

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
  }, 60 * 1000); // 1 minuto
};
