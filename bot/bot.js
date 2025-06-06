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

const DOMAIN = 'https://taskbattleserver.onrender.com'; 
const TOKEN = process.env.TG_BOT_TOKEN; 

// Если хочешь использовать вебхук, раскомментируй этот блок:
   


bot.launch({
  webhook: {
    domain: DOMAIN,
    port: 3002,
    hookPath: `/${TOKEN}`
  }
});


// Или просто за пускай так:
// bot.launch();

console.log('🤖 Bot запущен и ждёт команд!');
