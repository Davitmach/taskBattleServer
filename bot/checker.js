import { PrismaClient } from "@prisma/client";
import {bot} from './bot.js'; // путь к Telegraf боту
import ms from 'ms'; // если используешь, иначе вручную
const prisma2  =  new PrismaClient()
function checkerformatMinutesLeft(msLeft) {
  const minutes = Math.floor(msLeft / 60000);
  return minutes <= 0 ? '⏱ Время истекло!' : `⏱ Осталось: ${minutes} мин.`;
}
function escapeMarkdownV2Full(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\') // сначала экранируем обратный слэш
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1'); // экранируем спецсимволы, включая точку и восклицательный знак
}


export async function checkTasksDeadlines() {
  console.log('qaq');
  
  const tasks = await prisma2.taskBot.findMany({
    where: {
      status: 'IN_PROGRESS',
    },
    include: {
      taskExecutors: {
        include: { user: true },
      },
    },
  });

  const now = Date.now();

  for (const task of tasks) {
    const deadlineMs = new Date(task.deadline).getTime();
    const diff = deadlineMs - now;

    const alertTimes = [3600000, 1800000, 900000, 300000]; // 1ч, 30м, 15м, 5м

    
    for (const alert of alertTimes) {
      if (diff <= alert && diff > alert - 5 * 60000) {
        for (const executor of task.taskExecutors) {
          const name = executor.user.username
            ? `@${executor.user.username}`
            : `[${executor.user.name || 'пользователь'}](tg://user?id=${executor.user.tgId})`;
          try {
            const message = `❗ Время на выполнение задачи *${task.text}* вышло!\nВы не успели!`;
const escapedMessage = await escapeMarkdownV2Full(message);
           await bot.telegram.sendMessage(
  executor.user.tgId,
  escapedMessage,
  { parse_mode: 'MarkdownV2' }
);
          } catch (e) {
            console.error('Не удалось отправить напоминание:', e);
          }
        }
      }
    }

    // Если время вышло
    if (diff <= 0) {
      // Обновляем статус
      await prisma2.taskBot.update({
        where: { id: task.id },
        data: { status: 'FAILED' },
      });


      for (const executor of task.taskExecutors) {
        const name = executor.user.username
          ? `@${executor.user.username}`
          : `[${executor.user.name || 'пользователь'}](tg://user?id=${executor.user.tgId})`;
        try {
          await bot.telegram.sendMessage(
            executor.user.tgId,
            `❗ Время на выполнение задачи *${escapeMarkdownV2Full(task.text)}* вышло!\nВы не успели!`,
            { parse_mode: 'MarkdownV2' }
          );
        } catch (e) {
          console.error('Не удалось отправить оповещение о провале задачи:', e);
        }
      }
    }
  }
}

// Каждые 5 минут
setInterval(checkTasksDeadlines, 1 * 60 * 1000);

// Если хочешь вручную вызвать в начале
checkTasksDeadlines();
