import { bot } from "./bot.js";
import { PrismaClient } from "@prisma/client";
import fetch from 'node-fetch';
import ms from "ms";
const prisma = new PrismaClient();

export const SendMessage = async (message, chatId) => {
  try {
    const user = await prisma.user.findFirst({
      where: { chatId: String(chatId) },
      select: { id: true },
    });

    if (!user) {
      console.log(`Пользователь с chatId ${chatId} не найден. Сообщение не отправлено.`);
      return; 
    }
    await bot.telegram.sendMessage(chatId, message);
  
  } catch (error) {
    console.error("Ошибка при отправке сообщения:", error);
  }
};
export const SendFriendRequest = async (receiverChatId, friendRequestId,name) => {
  try {
    const user = await prisma.user.findFirst({
      where: { chatId: String(receiverChatId) },
      select: { id: true ,initData:true},
    });




    if (!user) {
      console.log(`Пользователь с chatId ${receiverChatId} не найден.`);
      return;
    }

    await bot.telegram.sendMessage(receiverChatId, `👤 ${name} добавил вас в друзья. Принять запрос?`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Принять", callback_data: `accept_friend_${friendRequestId}|${user.initData}` },
            { text: "❌ Отклонить", callback_data: `reject_friend_${friendRequestId}|${user.initData}` }
          ]
        ]
      }
    });

  } catch (err) {
    console.error("Ошибка при отправке инвайта:", err);
  }
};
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat?.id;

  if (!data) return await ctx.answerCbQuery("Нет данных");



  // Разбираем callback_data
  if (data.startsWith("accept_friend_")) {
    
    
    const friendRequestId = data.replace("accept_friend_", "");
const initData = data.split('|')[1]; 
const friendId = friendRequestId.split('|')[0]; 

  const add = await fetch(`http://localhost:3000/api/user/friend/accept/${friendId}`, {
  method: 'GET', 
  headers: {
    'tg-init-data': initData
  }
});

console.log(add);

    await ctx.editMessageText("✅ Запрос в друзья принят.");
    await ctx.answerCbQuery();

  } else if (data.startsWith("reject_friend_")) {
    const friendRequestId = data.replace("reject_friend_", "");
const initData = friendRequestId.split('|')[1];
console.log(initData,'aqaqadedadea');

const friendId = friendRequestId.split('|')[0];
   const rej = await fetch(`http://localhost:3000/api/user/friend/deleteOrCancel/${friendId}`,{
 method: 'GET', 
  headers: {
    'tg-init-data': initData
  }
    });

    

    await ctx.editMessageText("❌ Запрос в друзья отклонён.");
    await ctx.answerCbQuery();

  } else {
    await ctx.answerCbQuery("Неизвестная команда.");
  }
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

    // Получаем или создаём создателя
    const creator = await prisma.userBot.upsert({
      where: { tgId: fromId },
      update: {},
      create: {
        tgId: fromId,
        username: ctx.from.username || null,
        name: ctx.from.first_name || null,
      },
    });

    // Получаем или создаём исполнителей
    const executors = await Promise.all(usernames.map(async (u) => {
      return prisma.userBot.upsert({
        where: { username: u },
        update: {},
        create: {
          tgId: '', // пока пусто, заполнится при активности
          username: u,
          name: null,
        },
      });
    }));

    // Создаём задачу с исполнителями
    const task = await prisma.taskBot.create({
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

    // Отправляем уведомления исполнителям с tgId
    for (const exec of task.taskExecutors) {
      if (!exec.user.tgId) continue;
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
    }

    return ctx.reply('✅ Задача создана и отправлена исполнителям.');
  } catch (e) {
    console.error('Ошибка в addtask:', e);
    ctx.reply('❌ Произошла ошибка при создании задачи.');
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
      where: { tgId: fromId },
      include: {
        taskExecutors: {
          where: { task: { status: 'IN_PROGRESS' } },
          include: { task: true },
        },
      },
    });

    if (!user || user.taskExecutors.length === 0) {
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
    ctx.reply('❌ Ошибка при получении задач.');
  }
});


// bot.launch().then(() => {
//   console.log('🤖 Бот запущен');
// });