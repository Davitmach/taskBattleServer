import { bot } from "./bot.js";
import { PrismaClient } from "@prisma/client";
import fetch from 'node-fetch';
import ms from "ms";
const prisma = new PrismaClient();
const allowedAdminId = 123456789;
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
    w: 10080
  };

  return Math.floor(value * (multipliers[unit] || 0));
}

const ADMIN_IDS = ['482233894','1974611991']; // Telegram ID админов

bot.command('addtask', async (ctx) => {
  const fromId = String(ctx.from.id);
  if (!ADMIN_IDS.includes(fromId)) return ctx.reply('⛔ Только админы могут добавлять задачи.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('⚠️ Формат: /addtask @user1 @user2 Текст задачи 1h');

  const usernames = args.filter(a => a.startsWith('@')).map(a => a.replace('@', ''));
  const timeArg = args.at(-1);
  const text = args.slice(usernames.length, -1).join(' ');

  const minutes = parseDurationToMinutes(timeArg);
  if (minutes <= 0) return ctx.reply('⏰ Укажи корректное время');

  const deadline = new Date(Date.now() + minutes * 60000);

  // Получаем creator
  const creator = await prisma.userBot.upsert({
    where: { tgId: fromId },
    update: {},
    create: {
      tgId: fromId,
      username: ctx.from.username || '',
      name: ctx.from.first_name || '',
    }
  });

  // Получаем исполнителей
  const executors = await Promise.all(usernames.map(async (u) => {
    return prisma.userBot.upsert({
      where: { username: u },
      update: {},
      create: {
        tgId: '', // заполним позже после первой активности
        username: u,
        name: '',
      }
    });
  }));

  const task = await prisma.taskBot.create({
    data: {
      text,
      deadline,
      creatorId: creator.id,
      executors: {
        connect: executors.map(e => ({ id: e.id })),
      }
    }
  });

  // Рассылка участникам
  for (const exec of executors) {
    if (!exec.tgId) continue; // если tgId ещё не зарегистрирован

    await bot.telegram.sendMessage(exec.tgId, `📝 Новая задача: *${text}*\n⏳ До: ${deadline.toLocaleString()}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Выполнить", callback_data: `done_${task.id}` },
          { text: "❌ Отменить", callback_data: `cancel_${task.id}` }
        ]]
      }
    });
  }

  ctx.reply('✅ Задача создана.');
});


bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const fromId = String(ctx.from.id);

  if (data.startsWith('done_') || data.startsWith('cancel_')) {
    const [action, taskId] = data.split('_');

    const task = await prisma.taskBot.findUnique({
      where: { id: taskId },
      include: { executors: true }
    });

    const user = await prisma.userBot.findFirst({ where: { tgId: fromId } });
    if (!user) return ctx.answerCbQuery("⛔ Вы не зарегистрированы.");

    const isExecutor = task.executors.some(e => e.id === user.id);
    if (!isExecutor) return ctx.answerCbQuery("⛔ Вы не участник этой задачи.");

    const status = action === 'done' ? 'COMPLETED' : 'CANCELLED';

    await prisma.taskBot.update({
      where: { id: taskId },
      data: { status }
    });

    ctx.editMessageText(`Статус задачи обновлён: ${status === 'COMPLETED' ? '✅ Выполнена' : '❌ Отменена'}`);
    return ctx.answerCbQuery("✅ Готово");
  }
});


bot.command('mytasks', async (ctx) => {
  const user = await prisma.userBot.findFirst({ where: { tgId: String(ctx.from.id) }, include: {
    receivedTasks: true
  } });

  if (!user || user.receivedTasks.length === 0) return ctx.reply("🗂 У вас нет задач.");

  for (const task of user.receivedTasks) {
    if (task.status !== 'IN_PROGRESS') continue;

    await ctx.reply(`📝 *${task.text}*\n⏳ До: ${new Date(task.deadline).toLocaleString()}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Выполнить", callback_data: `done_${task.id}` },
          { text: "❌ Отменить", callback_data: `cancel_${task.id}` }
        ]]
      }
    });
  }
});
