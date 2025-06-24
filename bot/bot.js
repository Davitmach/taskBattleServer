import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
export const bot = new Telegraf(process.env.TG_BOT_TOKEN);

// Команда /start
bot.start(async (ctx) => {
  ctx.reply(
    `Привет, воин продуктивности! ⚔️

Я — TaskBattle, твой персональный трекер задач в формате игры. 🎯
Здесь ты можешь выполнять квесты (задачи), прокачиваться и побеждать дедлайны.

Нажми кнопку ниже, чтобы открыть мини-приложение и начать битву с прокрастинацией!`,
    Markup.inlineKeyboard([
      Markup.button.webApp('Открыть TaskBattle', 'https://task-battle.vercel.app/'),
    ])
  );
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('Ошибка в боте:', err);
});


const ADMIN_IDS = ['482233894', '1974611991']; // Твои админы (tgId как строки)

function parseDurationToMinutes(str) {
  const regex = /^(\d+(\.\d+)?)([mhdw])$/;
  const match = str.match(regex);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[3];

  const multipliers = {
    m: 1,
    h: 60,
    d: 1440,
    w: 10080,
  };

  return Math.floor(value * (multipliers[unit] || 0));
}
function escapeMarkdown(text) {
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')  // обязательно экранировать точку
    .replace(/!/g, '\\!')
    .replace(/\\/g, '\\\\'); // сначала нужно экранировать обратный слэш
}

function formatTimeLeft(ms) {
  if (ms <= 0) return '⏰ Время истекло';

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let parts = [];
  if (days > 0) parts.push(`${days} дн.`);
  if (hours > 0) parts.push(`${hours} ч.`);
  if (minutes > 0) parts.push(`${minutes} мин.`);
  if (parts.length === 0) parts.push('< 1 мин.');

  return parts.join(' ');
}


// Команда для добавления задачи
bot.command('addtask', async (ctx) => {
  try {
    const fromId = String(ctx.from.id);
    if (!ADMIN_IDS.includes(fromId)) {
      return ctx.reply('⛔ Только админы могут добавлять задачи.');
    }

    // Формат: /addtask @user1 @user2 Текст задачи 1h
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 3) {
      return ctx.reply('⚠️ Формат: /addtask @user1 @user2 Текст задачи 1h');
    }

    const usernames = args.filter(a => a.startsWith('@')).map(a => a.slice(1));
    const timeArg = args[args.length - 1];
    const text = args.slice(usernames.length, args.length - 1).join(' ');

    const minutes = parseDurationToMinutes(timeArg);
    if (minutes <= 0) {
      return ctx.reply('⏰ Укажи корректное время, например 10m, 1.5h, 2d');
    }

    const deadline = new Date(Date.now() + minutes * 60000);

    // Создатель
    let creator;
    try {
      creator = await prisma.userBot.upsert({
        where: { tgId: fromId },
        update: {
          username: ctx.from.username || null,
          name: ctx.from.first_name || null,
        },
        create: {
          tgId: fromId,
          username: ctx.from.username || null,
          name: ctx.from.first_name || null,
        },
      });
    } catch (err) {
      console.error('Ошибка при создании/получении создателя:', err);
      return ctx.reply('❌ Ошибка при работе с создателем задачи.');
    }

    // Исполнители
    let executors;
    try {
      executors = await Promise.all(usernames.map(async (u) => {
        try {
          let user = await prisma.userBot.findUnique({ where: { username: u } });
          if (!user) {
            user = await prisma.userBot.create({
              data: {
                username: u,
                tgId: null,
                name: null,
              },
            });
          }
          return user;
        } catch (err) {
          console.error(`Ошибка при создании/получении исполнителя @${u}:`, err);
          throw new Error(`Ошибка с исполнителем @${u}`);
        }
      }));
    } catch (err) {
      return ctx.reply(`❌ ${err.message}`);
    }

    // Задача
    let task;
    try {
      task = await prisma.taskBot.create({
        data: {
          text,
          deadline,
          creatorId: creator.id,
          taskExecutors: {
            create: executors.map(exec => ({ userId: exec.id })),
          },
        },
        include: { taskExecutors: { include: { user: true } } },
      });
    } catch (err) {
      console.error('Ошибка при создании задачи:', err);
      return ctx.reply('❌ Ошибка при создании задачи в базе.');
    }

    // Отправка уведомлений
    const results = [];

    for (const exec of task.taskExecutors) {
      const u = exec.user;
      if (!u.tgId) {
        results.push(`• ${u.username} — 🔴 не отправлено (нет tgId)`);
        continue;
      }
      try {
        await bot.telegram.sendMessage(
          u.tgId,
          `📝 Новая задача:\n*${escapeMarkdown(text)}*\n⏳ До: ${deadline.toLocaleString()}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Выполнить', callback_data: `done_${task.id}` },
                  { text: '❌ Отменить', callback_data: `cancel_${task.id}` },
                ],
              ],
            },
          }
        );
        results.push(`• ${u.username} — 🟢 отправлено`);
      } catch (err) {
        console.error(`Ошибка при отправке @${u.username}:`, err);
        results.push(`• ${u.username} — 🔴 ошибка отправки`);
      }
    }

    // Формат оставшегося времени
    function formatTimeLeft(deadline) {
      const ms = deadline - new Date();
      if (ms <= 0) return 'время вышло';

      const totalMinutes = Math.floor(ms / 60000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;

      const parts = [];
      if (days) parts.push(`${days}д`);
      if (hours) parts.push(`${hours}ч`);
      if (minutes) parts.push(`${minutes}м`);
      return parts.join(' ');
    }

    const summary =
      `✅ *Задача создана*\n` +
      `📝 *${escapeMarkdown(text)}*\n` +
      `⏳ (${formatTimeLeft(deadline)} осталось)\n\n` +
      `👥 *Исполнители:*\n` +
      results.join('\n');

    await ctx.reply(summary, { parse_mode: 'Markdown' });

  } catch (e) {
    console.error('Неожиданная ошибка в команде addtask:', e);
    ctx.reply('❌ Произошла неожиданная ошибка при создании задачи.');
  }
});

// Утилита для экранирования Markdown-символов



 


// Обработка кнопок Выполнить и Отменить
bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const fromId = String(ctx.from.id);

    if (!data.startsWith('done_') && !data.startsWith('cancel_')) {
      return ctx.answerCbQuery('Неизвестная команда.');
    }

    const [action, taskId] = data.split('_');

    const task = await prisma.taskBot.findUnique({
      where: { id: taskId },
      include: { taskExecutors: true },
    });
    if (!task) return ctx.answerCbQuery('Задача не найдена.');

    // Запретить изменение, если статус задачи не IN_PROGRESS
    if (task.status !== 'IN_PROGRESS') {
      return ctx.answerCbQuery('❌ Невозможно изменить статус — задача уже завершена или отменена.', { show_alert: true });
    }

    const user = await prisma.userBot.findFirst({ where: { tgId: fromId } });
    if (!user) return ctx.answerCbQuery('⛔ Вы не зарегистрированы.');

    const isExecutor = task.taskExecutors.some(e => e.userId === user.id);
    if (!isExecutor) return ctx.answerCbQuery('⛔ Вы не участник этой задачи.');

    const status = action === 'done' ? 'COMPLETED' : 'CANCELLED';

    await prisma.taskBot.update({
      where: { id: taskId },
      data: { status },
    });

    await ctx.editMessageText(`Статус задачи обновлён: ${status === 'COMPLETED' ? '✅ Выполнена' : '❌ Отменена'}`);
    return ctx.answerCbQuery('✅ Готово');
  } catch (error) {
    console.error('Ошибка в callback_query:', error);
    return ctx.answerCbQuery('Произошла ошибка.');
  }
});


// Команда просмотра своих задач
bot.command('mytasks', async (ctx) => {
  try {
    const fromId = String(ctx.from.id);
    const fromUsername = ctx.from.username || null;
    const fromName = ctx.from.first_name || null;

    let user = await prisma.userBot.findUnique({
      where: { tgId: fromId },
      include: {
        taskExecutors: {
          where: { task: { status: 'IN_PROGRESS' } },
          include: { task: true },
        },
      },
    });

    // Если не нашли по tgId — ищем по username
    if (!user && fromUsername) {
      const existingByUsername = await prisma.userBot.findUnique({
        where: { username: fromUsername },
      });

      if (existingByUsername) {
        // Обновляем tgId
        user = await prisma.userBot.update({
          where: { username: fromUsername },
          data: { tgId: fromId },
          include: {
            taskExecutors: {
              where: { task: { status: 'IN_PROGRESS' } },
              include: { task: true },
            },
          },
        });
      }
    }

    // Если всё равно не найден — создаём нового
    if (!user) {
      user = await prisma.userBot.create({
        data: {
          tgId: fromId,
          username: fromUsername,
          name: fromName,
        },
        include: {
          taskExecutors: {
            where: { task: { status: 'IN_PROGRESS' } },
            include: { task: true },
          },
        },
      });
      console.log(`✅ Зарегистрирован новый пользователь с tgId=${fromId}`);
    }

    if (!user.taskExecutors || user.taskExecutors.length === 0) {
      return ctx.reply('🗂 У вас нет активных задач.');
    }

    for (const te of user.taskExecutors) {
      const task = te.task;
      await ctx.reply(
        `📝 *${task.text}*\n⏳ До: ${new Date(task.deadline).toLocaleString()}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Выполнить', callback_data: `done_${task.id}` },
                { text: '❌ Отменить', callback_data: `cancel_${task.id}` },
              ],
            ],
          },
        }
      );
    }
  } catch (error) {
    console.error('Ошибка в mytasks:', error);
    ctx.reply(`❌ Ошибка при получении задач:\n${error.message || error}`);
  }
});

function escapeMarkdownV3(text) {
  if (!text) return '';
  // Сначала экранируем обратный слеш, затем все спецсимволы Telegram MarkdownV2, включая точку
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

bot.command('stats', async (ctx) => {
  try {
    const totalTasks = await prisma.taskBot.count();
    const completedTasks = await prisma.taskBot.count({ where: { status: 'COMPLETED' } });
    const inProgressTasks = await prisma.taskBot.count({ where: { status: 'IN_PROGRESS' } });

    const leaderboard = await prisma.taskExecutor.groupBy({
      by: ['userId'],
      where: { task: { status: 'COMPLETED' } },
      _count: { taskId: true },
      orderBy: { _count: { taskId: 'desc' } },
      take: 5,
    });

    const allUsers = await prisma.userBot.findMany();
    const leaderUserIds = leaderboard.map(l => l.userId);
    const slackers = allUsers.filter(u => !leaderUserIds.includes(u.id));
    const usersById = new Map(allUsers.map(u => [u.id, u]));

    const leadersText = leaderboard.map((l, i) => {
      const user = usersById.get(l.userId);
      const displayNameRaw = user?.username || user?.name || 'Неизвестный';
      const displayName = displayNameRaw.trim();
      const escapedName = escapeMarkdownV3(displayName);
      if (user?.tgId) {
        // Экранируем точку после номера списка
        return `${i + 1}\\. [${escapedName}](tg://user?id=${user.tgId}) — выполнено задач: ${l._count.taskId}`;
      } else {
        return `${i + 1}\\. @${escapedName} — выполнено задач: ${l._count.taskId}`;
      }
    }).join('\n') || 'Пока нет выполненных задач.';

    const slackersText = slackers.length > 0
      ? slackers.slice(0, 10).map((u, i) => {
          const displayNameRaw = u.username || u.name || 'Неизвестный';
          const displayName = displayNameRaw.trim();
          const escapedName = escapeMarkdownV3(displayName);
          if (u.tgId) {
            return `${i + 1}\\. [${escapedName}](tg://user?id=${u.tgId})`;
          } else {
            return `${i + 1}\\. @${escapedName}`;
          }
        }).join('\n')
      : 'Все пользователи выполнили хотя бы одну задачу!';

    const msg =
      `📊 *Статистика TaskBattle:*\n` +
      `Всего задач: *${totalTasks}*\n` +
      `Выполнено: *${completedTasks}*\n` +
      `В работе: *${inProgressTasks}*\n\n` +
      `🏆 *Топ исполнителей по выполненным задачам:*\n${leadersText}\n\n` +
      `⚠️ *Пользователи без выполненных задач:*\n${slackersText}`;

    await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.error('Ошибка в команде stats:', error);
    ctx.reply('❌ Произошла ошибка при получении статистики.');
  }
});






function escapeMarkdownV2(text) {
  // Экранирует спецсимволы Telegram MarkdownV2: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_\*\[\]\(\)~`>#+\-=|{}\.!])/g, '\\$1');
}


function formatTimeLeft2(ms) {
  if (ms <= 0) return '0 мин.';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let result = '';
  if (hours > 0) {
    result += `${hours} ч\\.`;  // точку экранируем вручную
  }
  if (minutes > 0) {
    if (result.length) result += ' ';
    result += `${minutes} мин\\.`;  // и здесь тоже
  }
  return result;
}



function escapeMarkdownalltask(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')     // Экранируем обратный слэш первым
    .replace(/([_\*\[\]\(\)~`>#+\-=|{}\.!])/g, '\\$1'); // Экранируем спецсимволы, включая точку
}

bot.command('alltasks', async (ctx) => {
  const fromId = String(ctx.from.id);
  if (!ADMIN_IDS.includes(fromId)) {
    return ctx.reply('⛔ Только админы могут просматривать все задачи.');
  }

  try {
    const tasks = await prisma.taskBot.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        taskExecutors: {
          include: { user: true },
        },
        creator: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (tasks.length === 0) {
      return ctx.reply('📂 Активных задач нет.');
    }

    for (const task of tasks) {
      const now = Date.now();
      const timeLeftMs = new Date(task.deadline).getTime() - now;
      const timeLeftFormatted = escapeMarkdownalltask(formatTimeLeft2(timeLeftMs));


      const executors = task.taskExecutors
        .map(e => {
          const name = escapeMarkdownalltask(e.user.name || e.user.username || String(e.user.tgId) || 'Без имени');
          return `• ${name}`;
        })
        .join('\n');

      const creatorName = escapeMarkdownalltask(task.creator.name || task.creator.username || String(task.creator.tgId) || 'Без имени');
      const taskText = escapeMarkdownalltask(task.text);

      await ctx.reply(
        `📝 *${taskText}*\n👤 Создатель: ${creatorName}\n⏳ Осталось: ${timeLeftFormatted}\n\n🧑‍💻 Исполнители:\n${executors}`,
        { parse_mode: 'MarkdownV2' }
      );
    }
  } catch (err) {
    console.error('Ошибка в alltasks:', err);
    return ctx.reply('❌ Ошибка при получении задач.');
  }
});










// Запуск с polling
bot.launch().then(() => {
  console.log('🤖 Bot запущен и ждёт команд!');
});
