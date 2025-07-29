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
export const SendTaskRequest = async(receiverChatId,taskParticipantId,userName,taskName)=> {
    try {
    const user = await prisma.user.findFirst({
      where: { chatId: String(receiverChatId) },
      select: { id: true ,initData:true},
    });

    if (!user) {
      console.log(`Пользователь с chatId ${receiverChatId} не найден.`);
      return;
    }

    await bot.telegram.sendMessage(receiverChatId, `👤 ${userName} добавил вас в таск ${taskName}. Принять запрос?`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Принять", callback_data: `accept_task_${taskParticipantId}|${user.initData}` },
            { text: "❌ Отклонить", callback_data: `reject_task_${taskParticipantId}|${user.initData}` }
          ]
        ]
      }
    });

  } catch (err) {
    console.error("Ошибка при отправке инвайта:", err);
  }
}
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat?.id;

console.log(data,'qaq');

  if (!data) return await ctx.answerCbQuery("Нет данных");


console.log(data,'qaq');

  // Разбираем callback_data
  if (data.startsWith("accept_friend_")) {
    
    
    const friendRequestId = data.replace("accept_friend_", "");
const initData = data.split('|')[1]; 
const friendId = friendRequestId.split('|')[0]; 
const check = await prisma.userFriend.findMany({
  where:{
    id:friendId
  }
})
if(check.length>0) {
  const add = await fetch(`http://taskbattleserver-production.up.railway.app/api/user/friend/accept/${friendId}`, {
  method: 'GET', 
  headers: {
    'tg-init-data': initData
  }
});

console.log(add);

    await ctx.editMessageText("✅ Запрос в друзья принят.");
    await ctx.answerCbQuery();
}
else {
   await ctx.editMessageText("Не актуально... запрос был удален");
    await ctx.answerCbQuery();
}
  } else if (data.startsWith("reject_friend_")) {
    const friendRequestId = data.replace("reject_friend_", "");
const initData = friendRequestId.split('|')[1];
console.log(initData,'aqaqadedadea');

const friendId = friendRequestId.split('|')[0];
const check = await prisma.userFriend.findMany({
  where:{
    id:friendId
  }
})
if(check.length>0) {
   const rej = await fetch(`http://taskbattleserver-production.up.railway.app/api/user/friend/deleteOrCancel/${friendId}`,{
 method: 'GET', 
  headers: {
    'tg-init-data': initData
  }
    });

    

    await ctx.editMessageText("❌ Запрос в друзья отклонён.");
    await ctx.answerCbQuery();
  }
  else {
    await ctx.editMessageText("Не актуально... запрос был удален");
    await ctx.answerCbQuery();
  }
  }
  else if(data.startsWith('accept_task_')) {

const taskRequestId = data.replace("accept_task_", "");
const initData = data.split('|')[1]; 
const friendId = taskRequestId.split('|')[0]; 
const check = await prisma.taskParticipant.findMany({
  where:{
    id:friendId
  }
})
if(check.length>0) {
  const add = await fetch(`http://taskbattleserver-production.up.railway.app/api/task/accept/${friendId}`, {
  method: 'GET', 
  headers: {
    'tg-init-data': initData
  }
});

console.log(add);

    await ctx.editMessageText("✅ Запрос в таск принят.");
    await ctx.answerCbQuery();
}
else {
   await ctx.editMessageText("Не актуально... запрос был удален");
    await ctx.answerCbQuery();
  }

  }





  else if(data.startsWith('reject_task_')) {
const friendRequestId = data.replace("reject_task_", "");
const initData = friendRequestId.split('|')[1];
console.log(initData,'aqaqadedadea');

const friendId = friendRequestId.split('|')[0];
const check = await prisma.taskParticipant.findMany({
  where:{
    id:friendId
  }
})
if(check.length>0) {
   const rej = await fetch(`http://taskbattleserver-production.up.railway.app/api/task/reject/${friendId}`,{
 method: 'GET', 
  headers: {
    'tg-init-data': initData
  }
    });

    

    await ctx.editMessageText("❌ Запрос в таск отклонён.");
    await ctx.answerCbQuery();
  }
  else {
    await ctx.editMessageText("Не актуально... запрос был удален");
    await ctx.answerCbQuery();
  }

  }
   else {
    await ctx.answerCbQuery("Неизвестная команда.");
  }
});


