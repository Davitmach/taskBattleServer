import { PrismaClient } from "@prisma/client";
import { localISOStringWithZ } from "../../utils/localtime.js";
import { SendMessage } from "../../bot/handlers.js";
import {parseInitData} from '../../utils/getuserid.js'
import * as dateFnsTz from 'date-fns-tz';
const zonedTimeToUtc = dateFnsTz.zonedTimeToUtc;

const prisma = new PrismaClient();

// export const Search = async (req,res)=> {
//   const { username } = req.body || {};
// if(!username) {
//     return res.status(404).json({ status: 'username are required' });
// }
// if(typeof username !=='string') return res.status(404).json({ status: 'username must be a string' });
// const initData = req.headers['tg-init-data'];
//  if (!initData) {
//         return res.status(404).json({ status: 'initData is required' });
//     }

//     const user = await prisma.user.findMany({
//         where: {        
//             name: {
//                 contains: username,
//                 mode: 'insensitive',
//             },
//         },
   
//         select: {
//       id: true,
//       name: true,
//       icon: true,
//       createdAt: true,
//       updatedAt: true,
//       tasks:true
//     },
//     });
//     res.status(200).json({ status: 'success', data: user });
// }

export const Search = async (req, res) => {
  const { username } = req.body || {};
  if (!username) {
    return res.status(404).json({ status: 'username is required' });
  }
  if (typeof username !== 'string') {
    return res.status(404).json({ status: 'username must be a string' });
  }

  const initData = req.headers['tg-init-data'];
  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  // Предположим, что в initData содержится chat_id пользователя
  const searchParams = new URLSearchParams(initData);
  const chatId = searchParams.get('user') ? JSON.parse(searchParams.get('user')).id : null;

  if (!chatId) {
    return res.status(404).json({ status: 'chatId not found in initData' });
  }

  // Получаем текущего пользователя по chatId
  const currentUser = await prisma.user.findFirst({
    where: { chatId: String(chatId) }
  });

  if (!currentUser) {
    return res.status(404).json({ status: 'Current user not found' });
  }

  const foundUsers = await prisma.user.findMany({
    where: {
      name: {
        contains: username,
        mode: 'insensitive',
      },
      NOT: { id: currentUser.id } // исключаем самого себя из результатов
    },
    select: {
      id: true,
      name: true,
      icon: true,
      createdAt: true,
      updatedAt: true,
      _count:{
        select:{
          tasks:true
        }
      }
    },
  });

  // Проверка на дружбу
  const friends = await prisma.userFriend.findMany({
    where: {
      OR: [
        {
          userId: currentUser.id,
          friendId: { in: foundUsers.map(u => u.id) },
       status:'ACCEPTED'
        },
        {
          friendId: currentUser.id,
          userId: { in: foundUsers.map(u => u.id) },
         status:'ACCEPTED'
        }
      ]
    }
  });

 

const friendIds = new Set(
  friends.map(f =>
    f.userId === currentUser.id ? f.friendId : f.userId
  )
);




  const usersWithFriendStatus = foundUsers.map(user => ({
    ...user,
    isFriend: friendIds.has(user.id)
  }));

  return res.status(200).json({ status: 'success', data: usersWithFriendStatus });
};

export const Report = async (req,res)=> {
  const { userId, report } = req.body || {};
if(!userId || !report) {
    return res.status(404).json({ status: 'userId and report are required' });
}
if(typeof userId !=='string' && typeof report !=='string') return res.status(404).json({ status: 'userId and report must be a string' });
if(typeof userId !=='string') return res.status(404).json({ status: 'userId must be a string' });
if(typeof report !=='string') return res.status(404).json({ status: 'report must be a string' });
const initData = req.headers['tg-init-data'];
 if (!initData) {
        return res.status(404).json({ status: 'initData is required' });
    }
const parsedUserId = parseInitData(initData)?.user?.id;
const checkUser = await prisma.user.findMany({
  where:{id:userId},
})
if(checkUser.length === 0) {
  return res.status(404).json({ status: 'user not found' });

}

    const user = await prisma.user.findMany({
        where: {initData:String(parsedUserId)},
        select: {
            id: true,

        },
    });
    const id =  user[0].id;
if(userId== id) {
  return res.status(404).json({ status: 'you cannot report yourself' });
}
    const Rep = await prisma.reports.create({
      data:{
         text:report,
         receiverId:userId,
         senderId:id
      }
    })
if(Rep) {
res.status(200).json({ status: 'success', data: { 
  info:'Report sent',
  report:Rep,
 } });
}
else {
  res.status(404).json({ status: 'error', data: { 
  info:'Report not sent',

 } });
}
   

}
// export const CreateTask = async (req,res)=> {
//   const { title, type, status, endTime,timeZone = 'UTC',friendId } = req.body || {};
//     const initData = req.headers['tg-init-data'];
//  if (!initData) {
//         return res.status(404).json({ status: 'initData is required' });
//     }
//     if(!friendId && type =='MULTI' ) {
//       return res.status(404).json({ status: 'friendId is required' });
//     }
//     if(!Array.isArray(friendId) && type =='MULTI') {
//       return res.status(404).json({ status: 'friendId must be an array' });
//     }
// if(!title || !type || !status || !endTime) {
//     return res.status(404).json({ status: 'title, type, status and endTime are required' });
// }
// const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

//   if (!iso8601Regex.test(endTime)) {
//     return res.status(400).json({ status: 'endTime must be in ISO 8601 format (e.g., 2025-05-22T13:40:18.468Z)' });
//   }

// const nowStr = localISOStringWithZ();

// const now = new Date(nowStr); 

// const end = new Date(endTime);

// const diffMs = end.getTime() - now.getTime();

// if (diffMs <= 0) {
//   return res.status(400).json({ status: 'endTime must be in the future' });
// }

//   const diffMinutes = Math.ceil(diffMs / (1000 * 60));
//   const parsedUserId = parseInitData(initData)?.user?.id;
// const getUser = await prisma.user.findFirst({
//   where:{initData:String(parsedUserId)}
// })

// const id = getUser.id;
//  if(type =='SINGLE') {
// const task = await prisma.task.create({
//   data:{
//     timeout:String(diffMinutes),
//     title:title,
//     type:type,
//     status:status,
//     endTime:endTime,
//     userId:id,
//   }
// });
// res.status(200).json({ status: 'success', data: { 
//   info:'Task created',
//   task: {
//     title,
//     type,
//     status,
//     endTime,
//     minutesLeft: diffMinutes
//   }}});
//  }
//  else {

// await prisma.$transaction(async (tx) => {
//   const task = await tx.task.create({
//     data: {
//       timeout: String(diffMinutes),
//       title,
//       type,
//       status,
//       endTime,
//       userId: id,
//     },
//   });

//   const taskId = task.id;

//   for (const friend of friendId) {
//     const user = await tx.user.findFirst({
//       where:{id: friend},
//     })
//     SendMessage(`Тебя пригласили в задание: ${title}`, user.chatId);
    
//     await tx.taskParticipant.create({
//       data: {
//      taskId:taskId,
//      userId: friend,
//       },
//     });
//   }
//   res.status(200).json({ status: 'success', data: { 
//   info:'Task created',
//   task: {
//     title,
//     type,
//     status,
//     endTime,
//     minutesLeft: diffMinutes
//   }}});
// });


//  }

  
// }




export const CreateTask = async (req, res) => {
  try {
    const { title, type, status, endTime, timeZone = 'UTC', friendId } = req.body || {};

    if (!title || !type || !status || !endTime) {
      return res.status(400).json({ status: 'title, type, status and endTime are required' });
    }

    // Проверяем формат ISO 8601 (UTC)
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
    if (!iso8601Regex.test(endTime)) {
      return res.status(400).json({ status: 'endTime must be in ISO 8601 UTC format, e.g., 2025-05-22T13:40:18.468Z' });
    }

    // Проверка для MULTI задач
    if (type === 'MULTI') {
      if (!friendId) {
        return res.status(400).json({ status: 'friendId is required for MULTI tasks' });
      }
      if (!Array.isArray(friendId)) {
        return res.status(400).json({ status: 'friendId must be an array' });
      }
    }

    // Конвертируем endTime с учетом таймзоны (на всякий случай)
    const endTimeUTC = zonedTimeToUtc(endTime, timeZone);

    const now = new Date();

    if (endTimeUTC <= now) {
      return res.status(400).json({ status: 'endTime must be in the future' });
    }

    const diffMinutes = Math.ceil((endTimeUTC.getTime() - now.getTime()) / (1000 * 60));

    // Получаем userId из initData
    const initData = req.headers['tg-init-data'];
    if (!initData) {
      return res.status(401).json({ status: 'initData header is required' });
    }
    const parsedUserId = parseInitData(initData)?.user?.id;
    if (!parsedUserId) {
      return res.status(401).json({ status: 'Invalid initData' });
    }

    const user = await prisma.user.findFirst({ where: { initData: String(parsedUserId) } });
    if (!user) {
      return res.status(401).json({ status: 'User not found' });
    }

    if (type === 'SINGLE') {
      const task = await prisma.task.create({
        data: {
          timeout: String(diffMinutes),
          title,
          type,
          status,
          endTime: endTimeUTC.toISOString(),
          userId: user.id,
        },
      });
      return res.status(200).json({
        status: 'success',
        data: {
          info: 'Task created',
          task: {
            title,
            type,
            status,
            endTime: endTimeUTC.toISOString(),
            minutesLeft: diffMinutes,
          },
        },
      });
    } else {
      // MULTI task — транзакция с добавлением участников
      await prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
          data: {
            timeout: String(diffMinutes),
            title,
            type,
            status,
            endTime: endTimeUTC.toISOString(),
            userId: user.id,
          },
        });

        for (const friend of friendId) {
          const friendUser = await tx.user.findFirst({ where: { id: friend } });
          if (friendUser) {
            // Предполагаем, что SendMessage — функция для уведомления, ее имплементируй отдельно
            SendMessage(`Тебя пригласили в задание: ${title}`, friendUser.chatId);
            await tx.taskParticipant.create({
              data: {
                taskId: task.id,
                userId: friend,
              },
            });
          }
        }

        res.status(200).json({
          status: 'success',
          data: {
            info: 'Task created',
            task: {
              title,
              type,
              status,
              endTime: endTimeUTC.toISOString(),
              minutesLeft: diffMinutes,
            },
          },
        });
      });
    }
  } catch (error) {
    console.error('CreateTask error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

export const GetUsers = async (req, res) => {
const {adminPassword} = req.body || {};
if(!adminPassword) {
    return res.status(404).json({ status: 'adminPassword is required' });
}
const Pass =  process.env.ADMIN;
const Split = Pass.split(',');
if(!Split.includes(adminPassword)) {
  return res.status(404).json({ status: 'adminPassword is incorrect' });
}
else {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      icon: true,
      createdAt: true,
      updatedAt: true,
      tasks: true,
      rewards:true,
    },
  });
  res.status(200).json({ status: 'success', data: users });
}
}


// export const Welcome = async (req, res) => {
//   const { name, icon, chatId } = req.body || {};
//   if (!name || !icon || !chatId) {
//     return res.status(404).json({ status: 'name, chatid and icon are required' });
//   }

//   const initData = req.headers['tg-init-data'];
//   if (!initData) {
//     return res.status(404).json({ status: 'initData is required' });
//   }

//   const parsedUserId = parseInitData(initData)?.user?.id;

//   const user = await prisma.user.findFirst({
//     where: { initData: String(parsedUserId) },
//     select: {
//       id: true,
//       name: true,
//       icon: true,
//       chatId: true,
//       createdAt: true,
//       updatedAt: true,
//       tasks: {
//         include: {
//           user: true,
//           participants: {
//             include: {
//               user: {
//                 select: { id: true, name: true, icon: true },
//               },
//             },
//           },
//         },
//       },
//       taskParticipations: {
//         select: {
//           task: {
//             include: {
//               user: true,
//               participants: {
//                 include: {
//                   user: {
//                     select: { id: true, name: true, icon: true },
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//       rewards: {
//         select: {
//           title: true,
//           description: true,
//         },
//       },
//     },
//   });

//   if (!user) {
//     await prisma.user.create({
//       data: {
//         initData: String(parsedUserId),
//         name: String(name),
//         icon: String(icon),
//         chatId: String(chatId),
//       },
//     });
//     return res.status(404).json({ status: 'unauthorized' });
//   }

//   const reports = await prisma.reports.findMany({
//     where: { receiverId: user.id },
//   });

//   if (reports.length > 10) {
//     SendMessage(`Ваш аккаунт заблокирован`, user.chatId);

//     await prisma.rewards.deleteMany({ where: { userId: user.id } });

//     const userTasks = await prisma.task.findMany({
//       where: { userId: user.id },
//       select: { id: true },
//     });

//     const userTaskIds = userTasks.map(task => task.id);

//     if (userTaskIds.length > 0) {
//       await prisma.taskParticipant.deleteMany({
//         where: { taskId: { in: userTaskIds } },
//       });
//       await prisma.task.deleteMany({
//         where: { id: { in: userTaskIds } },
//       });
//     }

//     await prisma.reports.deleteMany({ where: { receiverId: user.id } });
//     await prisma.userFriend.deleteMany({
//       where: {
//         OR: [{ userId: user.id }, { friendId: user.id }],
//       },
//     });
//     await prisma.user.delete({ where: { id: user.id } });

//     return res.status(403).json({ status: 'blocked', message: 'Your account is blocked due to reports.' });
//   }

//   function localISOStringWithZ() {
//     const now = new Date();
//     const tzOffset = now.getTimezoneOffset() * 60000;
//     return new Date(now - tzOffset).toISOString().slice(0, -1) + 'Z';
//   }

//   function calcTimeout(endTime) {
//     if (!endTime) return null;
//     const nowStr = localISOStringWithZ();
//     const now = new Date(nowStr);
//     const end = new Date(endTime);
//     const diffMs = end.getTime() - now.getTime();
//     return Math.floor(diffMs / 60000);
//   }

//   const ownTasks = user.tasks
//     .map(task => ({
//       ...task,
//       isOwner: true,
//       timeout: task.status === 'IN_PROGRESS' ? calcTimeout(task.endTime) : Number(task.timeout),
//     }))
//     .filter(task => task.timeout !== null);

//   const participatedTasks = user.taskParticipations
//     .map(({ task }) => ({
//       ...task,
//       isOwner: task.userId === user.id,
//       timeout: task.status === 'IN_PROGRESS' ? calcTimeout(task.endTime) : Number(task.timeout),
//     }))
//     .filter(task => task.timeout !== null);

//   const taskMap = new Map();
//   [...ownTasks, ...participatedTasks].forEach(task => {
//     taskMap.set(task.id, task);
//   });

//   function getRandomElement(arr) {
//     return arr[Math.floor(Math.random() * arr.length)];
//   }

//   function generateTaskComment(task, now = new Date()) {
//     if (!task.endTime) return null;
//     const end = new Date(task.endTime);
//     const diffMinutes = Math.floor((end - now) / 60000);

//     if (diffMinutes >= 15) {
//       return `<p id="white">${getRandomElement([
//         'Вау, с запасом справился! 💪',
//         'Мастер тайм-менеджмента!',
//         'Ты сделал это быстрее, чем я успел моргнуть 👀',
//         'Настоящий профи — всё заранее!',
//       ])}</p>`;
//     } else if (diffMinutes >= 0) {
//       return `<p id="white">${getRandomElement([
//         'Успел вовремя, хорошая работа! 👍',
//         'Как по часам ⏰',
//         'Точно в срок — приятно видеть!',
//         'Ты как швейцарские часы!',
//       ])}</p>`;
//     } else if (diffMinutes >= -10) {
//       return `<p id="yellow">${getRandomElement([
//         'Чуть-чуть не успел, но всё равно молодец!',
//         'На грани, но сойдёт 😅',
//         'Опоздание небольшое, бывает...',
//         'Следующий раз чуть быстрее — и будет идеально!',
//       ])}</p>`;
//     } else {
//       return `<p id="red">${getRandomElement([
//         'Ты где пропадал? 😅',
//         'Опоздание уровня "школа жизни"',
//         'Эта задача уже покрылась пылью...',
//         'Нужно срочно качать дедлайн-мышцу! 🕰️',
//       ])}</p>`;
//     }
//   }

//   const tasks = Array.from(taskMap.values()).map(task => {
//     const amOwner = task.userId === user.id;
//     return {
//       id: task.id,
//       title: task.title,
//       timeout: task.timeout,
//       type: task.type,
//       status: task.status,
//       endTime: task.endTime,
//       owner: {
//         id: task.user.id,
//         name: task.user.name,
//         icon: task.user.icon,
//       },
//       participants: task.participants
//         .filter(p => amOwner || p.user.id !== user.id)
//         .map(p => ({
//           id: p.user.id,
//           name: p.user.name,
//           icon: p.user.icon,
//         })),
//       comment: generateTaskComment(task),
//     };
//   });

//   const allTasks = [...ownTasks, ...participatedTasks];
//   const taskCounter = {
//     cancelled: 0,
//     in_progress: 0,
//     completed: 0,
//   };

//   for (const task of allTasks) {
//     if (task.status === 'CANCELLED') taskCounter.cancelled += 1;
//     if (task.status === 'IN_PROGRESS') taskCounter.in_progress += 1;
//     if (task.status === 'COMPLETED') taskCounter.completed += 1;
//   }

//   // === Добавляем процент обладателей наград ===

//   const totalUsers = await prisma.user.count();
//   const userRewards = user.rewards;

//   const rewardStats = await prisma.rewards.groupBy({
//     by: ['title'],
//     where: {
//       title: {
//         in: userRewards.map(r => r.title),
//       },
//     },
//     _count: {
//       title: true,
//     },
//   });

//   const rewardsWithPercentages = userRewards.map(reward => {
//     const found = rewardStats.find(r => r.title === reward.title);
//     const count = found?._count.title || 0;
//     const percentage = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;

//     return {
//       ...reward,
//       percentage,
//     };
//   });

//   // === Ответ ===

//   return res.status(200).json({
//     status: 'authorized',
//     tasks,
//     taskCounter,
//     user: {
//       id: user.id,
//       name: user.name,
//       icon: user.icon,
//       chatId: user.chatId,
//       createdAt: user.createdAt,
//       updatedAt: user.updatedAt,
//       rewards: rewardsWithPercentages,
//     },
//   });
// };

export const Welcome = async (req, res) => {
  const { name, icon, chatId } = req.body || {};
  if (!name || !icon || !chatId) {
    return res.status(404).json({ status: 'name, chatid and icon are required' });
  }

  const initData = req.headers['tg-init-data'];
  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  const parsedUserId = parseInitData(initData)?.user?.id;

  const user = await prisma.user.findFirst({
    where: { initData: String(parsedUserId) },
    select: {
      id: true,
      name: true,
      icon: true,
      chatId: true,
      createdAt: true,
      updatedAt: true,
      tasks: {
        include: {
          user: true,
          participants: {
            include: {
              user: {
                select: { id: true, name: true, icon: true },
              },
            },
          },
        },
      },
      taskParticipations: {
        select: {
          task: {
            include: {
              user: true,
              participants: {
                include: {
                  user: {
                    select: { id: true, name: true, icon: true },
                  },
                },
              },
            },
          },
        },
      },
      rewards: {
        select: {
          title: true,
          description: true,
        },
      },
    },
  });

  if (!user) {
    await prisma.user.create({
      data: {
        initData: String(parsedUserId),
        name: String(name),
        icon: String(icon),
        chatId: String(chatId),
      },
    });
    return res.status(404).json({ status: 'unauthorized' });
  }

  // Проверка на блокировку пользователя (по репортам)
  const reports = await prisma.reports.findMany({
    where: { receiverId: user.id },
  });

  if (reports.length > 10) {
    SendMessage(`Ваш аккаунт заблокирован`, user.chatId);

    await prisma.rewards.deleteMany({ where: { userId: user.id } });

    const userTasks = await prisma.task.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    const userTaskIds = userTasks.map(task => task.id);

    if (userTaskIds.length > 0) {
      await prisma.taskParticipant.deleteMany({
        where: { taskId: { in: userTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: userTaskIds } },
      });
    }

    await prisma.reports.deleteMany({ where: { receiverId: user.id } });
    await prisma.userFriend.deleteMany({
      where: {
        OR: [{ userId: user.id }, { friendId: user.id }],
      },
    });
    await prisma.user.delete({ where: { id: user.id } });

    return res.status(403).json({ status: 'blocked', message: 'Your account is blocked due to reports.' });
  }

  // Функция подсчёта таймаута (минуты до endTime) — корректно для UTC
  function calcTimeout(endTime) {
    if (!endTime) return null;
    const now = new Date();
    const end = new Date(endTime);
    const diffMs = end.getTime() - now.getTime();
    return Math.floor(diffMs / 60000);
  }

  // Формируем задачи владельца
  const ownTasks = user.tasks
    .map(task => ({
      ...task,
      isOwner: true,
      timeout: task.status === 'IN_PROGRESS' ? calcTimeout(task.endTime) : Number(task.timeout),
    }))
    .filter(task => task.timeout !== null);

  // Формируем задачи, в которых участвует пользователь
  const participatedTasks = user.taskParticipations
    .map(({ task }) => ({
      ...task,
      isOwner: task.userId === user.id,
      timeout: task.status === 'IN_PROGRESS' ? calcTimeout(task.endTime) : Number(task.timeout),
    }))
    .filter(task => task.timeout !== null);

  const taskMap = new Map();
  [...ownTasks, ...participatedTasks].forEach(task => {
    taskMap.set(task.id, task);
  });

  function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateTaskComment(task, now = new Date()) {
    if (!task.endTime) return null;
    const end = new Date(task.endTime);
    const diffMinutes = Math.floor((end - now) / 60000);

    if (diffMinutes >= 15) {
      return `<p id="white">${getRandomElement([
        'Вау, с запасом справился! 💪',
        'Мастер тайм-менеджмента!',
        'Ты сделал это быстрее, чем я успел моргнуть 👀',
        'Настоящий профи — всё заранее!',
      ])}</p>`;
    } else if (diffMinutes >= 0) {
      return `<p id="white">${getRandomElement([
        'Успел вовремя, хорошая работа! 👍',
        'Как по часам ⏰',
        'Точно в срок — приятно видеть!',
        'Ты как швейцарские часы!',
      ])}</p>`;
    } else if (diffMinutes >= -10) {
      return `<p id="yellow">${getRandomElement([
        'Чуть-чуть не успел, но всё равно молодец!',
        'На грани, но сойдёт 😅',
        'Опоздание небольшое, бывает...',
        'Следующий раз чуть быстрее — и будет идеально!',
      ])}</p>`;
    } else {
      return `<p id="red">${getRandomElement([
        'Ты где пропадал? 😅',
        'Опоздание уровня "школа жизни"',
        'Эта задача уже покрылась пылью...',
        'Нужно срочно качать дедлайн-мышцу! 🕰️',
      ])}</p>`;
    }
  }

  const tasks = Array.from(taskMap.values()).map(task => {
    const amOwner = task.userId === user.id;
    return {
      id: task.id,
      title: task.title,
      timeout: task.timeout,
      type: task.type,
      status: task.status,
      endTime: task.endTime,
      owner: {
        id: task.user.id,
        name: task.user.name,
        icon: task.user.icon,
      },
      participants: task.participants
        .filter(p => amOwner || p.user.id !== user.id)
        .map(p => ({
          id: p.user.id,
          name: p.user.name,
          icon: p.user.icon,
        })),
      comment: generateTaskComment(task),
    };
  });

  const allTasks = [...ownTasks, ...participatedTasks];
  const taskCounter = {
    cancelled: 0,
    in_progress: 0,
    completed: 0,
  };

  for (const task of allTasks) {
    if (task.status === 'CANCELLED') taskCounter.cancelled += 1;
    if (task.status === 'IN_PROGRESS') taskCounter.in_progress += 1;
    if (task.status === 'COMPLETED') taskCounter.completed += 1;
  }

  // Добавляем проценты обладателей наград
  const totalUsers = await prisma.user.count();
  const userRewards = user.rewards;

  const rewardStats = await prisma.rewards.groupBy({
    by: ['title'],
    where: {
      title: {
        in: userRewards.map(r => r.title),
      },
    },
    _count: {
      title: true,
    },
  });

  const rewardsWithPercentages = userRewards.map(reward => {
    const found = rewardStats.find(r => r.title === reward.title);
    const count = found?._count.title || 0;
    const percentage = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;

    return {
      ...reward,
      percentage,
    };
  });

  return res.status(200).json({
    status: 'authorized',
    tasks,
    taskCounter,
    user: {
      id: user.id,
      name: user.name,
      icon: user.icon,
      chatId: user.chatId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      rewards: rewardsWithPercentages,
    },
  });
};
