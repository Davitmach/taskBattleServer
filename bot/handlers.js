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
// export const SendFriendRequest = async (receiverChatId, friendRequestId,name) => {
//   try {
//     const user = await prisma.user.findFirst({
//       where: { chatId: String(receiverChatId) },
//       select: { id: true ,initData:true},
//     });




//     if (!user) {
//       console.log(`Пользователь с chatId ${receiverChatId} не найден.`);
//       return;
//     }

//     await bot.telegram.sendMessage(receiverChatId, `👤 ${name} добавил вас в друзья. Принять запрос?`, {
//       reply_markup: {
//         inline_keyboard: [
//           [
//             { text: "✅ Принять", callback_data: `accept_friend_${friendRequestId}|${user.initData}` },
//             { text: "❌ Отклонить", callback_data: `reject_friend_${friendRequestId}|${user.initData}` }
//           ]
//         ]
//       }
//     });

//   } catch (err) {
//     console.error("Ошибка при отправке инвайта:", err);
//   }
// };
// bot.on('callback_query', async (ctx) => {
//   const data = ctx.callbackQuery.data;
//   const chatId = ctx.chat?.id;

//   if (!data) return await ctx.answerCbQuery("Нет данных");



//   // Разбираем callback_data
//   if (data.startsWith("accept_friend_")) {
    
    
//     const friendRequestId = data.replace("accept_friend_", "");
// const initData = data.split('|')[1]; 
// const friendId = friendRequestId.split('|')[0]; 

//   const add = await fetch(`http://localhost:3000/api/user/friend/accept/${friendId}`, {
//   method: 'GET', 
//   headers: {
//     'tg-init-data': initData
//   }
// });

// console.log(add);

//     await ctx.editMessageText("✅ Запрос в друзья принят.");
//     await ctx.answerCbQuery();

//   } else if (data.startsWith("reject_friend_")) {
//     const friendRequestId = data.replace("reject_friend_", "");
// const initData = friendRequestId.split('|')[1];
// console.log(initData,'aqaqadedadea');

// const friendId = friendRequestId.split('|')[0];
//    const rej = await fetch(`http://localhost:3000/api/user/friend/deleteOrCancel/${friendId}`,{
//  method: 'GET', 
//   headers: {
//     'tg-init-data': initData
//   }
//     });

    

//     await ctx.editMessageText("❌ Запрос в друзья отклонён.");
//     await ctx.answerCbQuery();

//   } else {
//     await ctx.answerCbQuery("Неизвестная команда.");
//   }
// });



// 1. Отправляем запрос
export const SendFriendRequest = async (receiverChatId, friendRequestId, name) => {
  try {
    const user = await prisma.user.findFirst({
      where: { chatId: String(receiverChatId) },
      select: { initData: true },
    });
    if (!user) return console.log(`chatId ${receiverChatId} не найден`);

    await bot.telegram.sendMessage(
      receiverChatId,
      `👤 ${name} добавил вас в друзья. Принять запрос?`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Принять",  callback_data: `accept_friend_${friendRequestId}|${user.initData}` },
            { text: "❌ Отклонить", callback_data: `reject_friend_${friendRequestId}|${user.initData}` }
          ]]
        }
      }
    );
  } catch (e) {
    console.error("Ошибка SendFriendRequest:", e);
  }
};

// 2. Обработка callback-кнопок
bot.on("callback_query", async (ctx) => {
  try {
    const raw = ctx.callbackQuery.data || "";
    console.log("callback:", raw);

    // Шаблон accept_friend_123|initData  или  reject_friend_123|initData
    const match = raw.match(/^(accept|reject)_friend_(\d+)\|(.*)$/);
    if (!match) {
      await ctx.answerCbQuery("Неизвестная команда");
      return;
    }

    const [, action, requestId, initData] = match;
    const api =
      action === "accept"
        ? `http://localhost:3000/api/user/friend/accept/${requestId}`
        : `http://localhost:3000/api/user/friend/deleteOrCancel/${requestId}`;

    const res = await fetch(api, {
      method: "GET",
      headers: { "tg-init-data": initData },
    });

    // Если запрос уже удалён => показываем предупреждение
    if (!res.ok) {
      await ctx.answerCbQuery("Запрос уже недействителен", { show_alert: true });
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.editMessageText("⚠️ Запрос больше неактуален.");
      return;
    }

    // Всё прошло — меняем текст и УБИРАЕМ кнопки
    const doneText =
      action === "accept"
        ? "✅ Запрос в друзья принят."
        : "❌ Запрос в друзья отклонён.";

    await ctx.editMessageText(doneText, { reply_markup: undefined });
    await ctx.answerCbQuery(); // короткий «тик» без текста
  } catch (err) {
    console.error("callback_query error:", err);
    await ctx.answerCbQuery("Ошибка, попробуйте позже");
  }
});
