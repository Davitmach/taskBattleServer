import { PrismaClient } from "@prisma/client";
import { bot } from './bot.js';

const prisma = new PrismaClient();

// 🔐 Экранирование MarkdownV2
function escapeMarkdownV2Full(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\') // сначала экранируем обратный слэш
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1'); // экранируем спецсимволы
}

// ⏱ Формат оставшегося времени
function formatMinutesLeft(msLeft) {
  const minutes = Math.floor(msLeft / 60000);
  return minutes <= 0 ? '⏱ Время истекло!' : `⏱ Осталось: ${minutes} мин.`;
}

// 🧠 Главная проверка
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
      if (diff <= alert && diff > alert - 60000) {
        for (const executor of task.taskExecutors) {
          if (!executor.user?.tgId) {
            console.warn(`⚠️ tgId отсутствует у пользователя ID=${executor.user?.id}`);
            continue;
          }

          const rawMsg = `⏰ Напоминание!\nЗадача *${task.text}*\n${formatMinutesLeft(diff)}`;
          const msg = escapeMarkdownV2Full(rawMsg);

          try {
            console.log(`📩 Отправляю напоминание пользователю ${executor.user.tgId} по задаче "${task.text}"`);
            await bot.telegram.sendMessage(executor.user.tgId, msg, {
              parse_mode: 'MarkdownV2',
            });
          } catch (e) {
            console.error('❌ Ошибка при отправке напоминания:', e);
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
        if (!executor.user?.tgId) {
          console.warn(`⚠️ tgId отсутствует у пользователя ID=${executor.user?.id}`);
          continue;
        }

        const rawMsg = `❗ Время на выполнение задачи *${task.text}* вышло!\nВы не успели!`;
        const msg = escapeMarkdownV2Full(rawMsg);

        try {
          console.log(`📩 Отправляю уведомление о провале задачи "${task.text}" пользователю ${executor.user.tgId}`);
          await bot.telegram.sendMessage(executor.user.tgId, msg, {
            parse_mode: 'MarkdownV2',
          });
        } catch (e) {
          console.error('❌ Ошибка при отправке уведомления о провале:', e);
        }
      }
    }
  }
}


setInterval(checkTasksDeadlines, 60 * 1000);


checkTasksDeadlines();
