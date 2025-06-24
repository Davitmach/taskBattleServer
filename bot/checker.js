import { PrismaClient } from "@prisma/client";
import { bot } from './bot.js';
const prisma = new PrismaClient();

function escapeMarkdownV2Full(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\') // сначала экранируем слэши
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1'); // потом всё остальное
}

function formatMinutesLeft(msLeft) {
  const minutes = Math.floor(msLeft / 60000);
  return minutes <= 0 ? '⏱ Время истекло!' : `⏱ Осталось: ${minutes} мин.`;
}

export async function checkTasksDeadlines() {
  const now = Date.now();
  console.log(`⏰ checkTasksDeadlines вызван в ${new Date().toLocaleString()}`);

  const tasks = await prisma.taskBot.findMany({
    where: { status: 'IN_PROGRESS' },
    include: {
      taskExecutors: {
        include: { user: true },
      },
    },
  });

  const alertTimes = [3600000, 1800000, 900000, 300000]; // 1ч, 30м, 15м, 5м

  for (const task of tasks) {
    const deadlineMs = new Date(task.deadline).getTime();
    const diff = deadlineMs - now;

    // 🔔 Напоминания
    for (const alert of alertTimes) {
      if (diff <= alert && diff > alert - 60000) { // В течение 1 минуты до момента
        for (const executor of task.taskExecutors) {
          const name = executor.user.username
            ? `@${executor.user.username}`
            : `[${executor.user.name || 'пользователь'}](tg://user?id=${executor.user.tgId})`;

          const msg = `⏰ Напоминание!\nЗадача *${task.text}*\n${formatMinutesLeft(diff)}`;
          const escaped = escapeMarkdownV2Full(msg);

          try {
            await bot.telegram.sendMessage(executor.user.tgId, escaped, {
              parse_mode: 'MarkdownV2',
            });
          } catch (e) {
            console.error('Не удалось отправить напоминание:', e);
          }
        }
      }
    }

    // ❌ Просроченные
    if (diff <= 0) {
      await prisma.taskBot.update({
        where: { id: task.id },
        data: { status: 'FAILED' },
      });

      for (const executor of task.taskExecutors) {
        const msg = `❗ Время на выполнение задачи *${task.text}* вышло!\nВы не успели!`;
        const escaped = escapeMarkdownV2Full(msg);

        try {
          await bot.telegram.sendMessage(executor.user.tgId, escaped, {
            parse_mode: 'MarkdownV2',
          });
        } catch (e) {
          console.error('Не удалось отправить оповещение о провале задачи:', e);
        }
      }
    }
  }
}

// 🔁 Проверять каждую минуту
setInterval(checkTasksDeadlines, 60 * 1000);

// ▶️ Первый запуск сразу
checkTasksDeadlines();
