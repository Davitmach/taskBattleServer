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

    let executors;
    try {
   executors = await Promise.all(usernames.map(async (u) => {
  try {
    let user = await prisma.userBot.findUnique({ where: { username: u } });
    if (!user) {
      user = await prisma.userBot.create({
        data: {
          username: u,
          tgId: null,  // null вместо пустой строки
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

    // Отправка уведомлений с проверкой tgId
    for (const exec of task.taskExecutors) {
      if (!exec.user.tgId) {
        console.log(`Пропускаем отправку @${exec.user.username} — нет tgId`);
        continue;
      }
      try {
        await bot.telegram.sendMessage(
          exec.user.tgId,
          `📝 Новая задача:\n*${text}*\n⏳ До: ${deadline.toLocaleString()}`,
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
      } catch (err) {
        console.error(`Ошибка при отправке сообщения @${exec.user.username}:`, err);
      }
    }

    return ctx.reply('✅ Задача создана и отправлена исполнителям.');

  } catch (e) {
    console.error('Неожиданная ошибка в команде addtask:', e);
    ctx.reply('❌ Произошла неожиданная ошибка при создании задачи.');
  }
});

 


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
    
    
    const user = await prisma.userBot.findFirst({
      where: { tgId: fromId},
      include: {
        taskExecutors: {
          where: { task: { status: 'IN_PROGRESS' } },
          include: { task: true },
        },
      },
    });
console.log(user,'qaqaqaqswswsw');

    if (!user) {
      console.log(`Пользователь с tgId=${fromId} не найден в базе userBot.`);
      return ctx.reply('🗂 У вас нет активных задач или вы не зарегистрированы.');
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
    // Показываем текст ошибки пользователю для отладки (можно убрать потом)
    ctx.reply(`❌ Ошибка при получении задач:\n${error.message || error}`);
  }
});








// Запуск с polling
bot.launch().then(() => {
  console.log('🤖 Bot запущен и ждёт команд!');
});
