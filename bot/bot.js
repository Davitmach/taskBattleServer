import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

const TOKEN = process.env.TG_BOT_TOKEN;
const DOMAIN = 'https://taskbattleserver.onrender.com'; // твой Render-домен

if (!TOKEN) {
  throw new Error("TG_BOT_TOKEN не указан в .env");
}

export const bot = new Telegraf(TOKEN);

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

// ✅ Вебхук вместо polling:
bot.launch({
  webhook: {
    domain: DOMAIN,
    port: process.env.PORT || 3000,
    hookPath: `/${TOKEN}`,
  },
});

console.log('🤖 Бот запущен через Webhook!');
