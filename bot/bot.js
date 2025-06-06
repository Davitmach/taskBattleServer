import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
dotenv.config()
export const bot = new Telegraf(process.env.TG_BOT_TOKEN);

bot.start(async(ctx) => {


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

const PORT = parseInt(process.env.PORT || '3000', 10); // используем PORT от Render
const DOMAIN = 'https://taskbattleserver.onrender.com'; // адрес деплоя

bot.launch({
  webhook: {
    domain: DOMAIN,
    port: PORT,
    hookPath: `/${process.env.TG_BOT_TOKEN}`
  }
});


// Или просто запускай так:
// bot.launch();

console.log('🤖 Bot запущен и ждёт команд!');
