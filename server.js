import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot("7311122619:AAHJk7WdmfWEMYqGAMPry2ybIAMIgNrC3W0", { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Кнопка с Web App (мини-приложением)
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть мини-приложение',
            web_app: {
              url: 'https://task-battle.vercel.app/'  // URL вашего мини-приложения
            }
          }
        ]
      ]
    }
  };

  bot.sendMessage(chatId, 'Привет! Нажми на кнопку, чтобы открыть мини-приложение.', options);
});
