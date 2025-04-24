

import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf('7311122619:AAHJk7WdmfWEMYqGAMPry2ybIAMIgNrC3W0');

bot.start((ctx) => {
  ctx.reply(
    'Привет! Нажми на кнопку, чтобы открыть мини-приложение.',
    Markup.inlineKeyboard([
      Markup.button.webApp('Открыть мини-приложение', 'https://task-battle.vercel.app/'),
    ])
  );
});
const DOMAIN = 'https://taskbattleserver.onrender.com'; 
const TOKEN = '7311122619:AAHJk7WdmfWEMYqGAMPry2ybIAMIgNrC3W0'; 
bot.launch({
  webhook: {
    domain: DOMAIN,
    port:  3002, 
    hookPath: `/${TOKEN}`
  }
});