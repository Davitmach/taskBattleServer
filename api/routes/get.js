import { PrismaClient } from "@prisma/client";
import { SendFriendRequest, SendMessage } from "../../bot/handlers.js";
import { localISOStringWithZ } from "../../utils/localtime.js";
import { subDays, subWeeks, subMonths, format, startOfDay } from "date-fns";
import { parseInitData } from "../../utils/getuserid.js";
const prisma = new PrismaClient();
export const Friends = async (req, res) => {
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  const parsedUserId = parseInitData(initData)?.user?.id;
  const user = await prisma.user.findFirst({
    where: { initData: String(parsedUserId) }
  });

  if (!user) {
    return res.status(404).json({ status: 'User not found' });
  }

  const id = user.id;

  const friends = await prisma.userFriend.findMany({
    where: { 
      OR: [
        { userId: id },   // Мы добавили этих друзей
        { friendId: id }  // Эти друзья добавили нас
      ],
   
    },
    select: {
      id: true,
      status: true,
      userId: true,    // Добавляем эти поля для определения направления
      friendId: true,
      user: {          // Данные инициатора (когда friendId == id)
        select: {
          id: true,
          name: true,
          icon: true,
          _count: { select: { tasks: true,taskParticipations:true } }
        }
      },
      friend: {        // Данные друга (когда userId == id)
        select: {
          id: true,
          name: true,
          icon: true,
          _count: { select: { tasks: true,taskParticipations:true } }
        }
      }
    }
  });

  if (friends.length > 0) {
    const formattedFriends = friends.map(f => {
      // Если userId == id, то это друг (friend), иначе это пользователь, который нас добавил (user)
      const friendData = f.userId === id ? f.friend : f.user;
      return {
        userFriendId: f.id,
        status: f.status,
        ...friendData
      };
    });

    return res.status(200).json({ status: 'success', data: formattedFriends });
  } else {
    return res.status(404).json({ status: 'no friends found' });
  }
};
export const Tasks = async (req, res) => {
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }
const parsedUserId = parseInitData(initData)?.user?.id;
  const user = await prisma.user.findFirst({
    where: { initData:String(parsedUserId) },
    select: {
      id: true,
      taskParticipations: {
        where:{status:'ACCEPTED'},
        select: {
          task: {    
            select: {
        
              id: true,
              title: true,
              type: true,
              status: true,
              timeout: true,
              endTime: true,
              participants: {
                
                select: {
                  
                  user: {
                    select: {
                    
                      id: true, name: true, icon: true },
                  },
                },
              },
              user: {
                select: { id: true, name: true, icon: true },
              },
            },
          },
        },
      },
      tasks: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          timeout: true,
          endTime: true,
          participants: {
            where:{
              status:"ACCEPTED"
            },
            select: {
              
              user: {
                
                select: {
                    _count:{
                        select:{
                          tasks:true,
                          taskParticipations:true
                        }
                      }, id: true, name: true, icon: true },
              },
            },
          },
          user: {
            select: { id: true, name: true, icon: true },
          },
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ status: 'user not found' });
  }

  function calcTimeout(endTime) {
    if (!endTime) return null;
    const nowStr = localISOStringWithZ();
const now = new Date(nowStr); 


const end = new Date(endTime);
    const diffMs = end.getTime() - now.getTime();
    return Math.floor(diffMs / 60000);
  }

  const ownTasks = user.tasks.map(task => ({
    ...task,
    isOwner: true,
    timeout: task.status=='IN_PROGRESS' ? calcTimeout(task.endTime) : Number(task.timeout),
  }));

  const participatedTasks = user.taskParticipations.map(({ task }) => ({
    ...task,
    isOwner: task.user.id === user.id,
    timeout: task.status=='IN_PROGRESS' ? calcTimeout(task.endTime) : Number(task.timeout),
  }));

  // Удалим дубли по ID
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
  const diffMinutes = Math.floor((end - now) / 60000); // end - now

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

  const tasks = Array.from(taskMap.values()).map(task => ({
    id: task.id,
    title: task.title,
    type: task.type,
    status: task.status,
    timeout: task.timeout,
    endTime: task.endTime,
    owner: task.user,
    participants: task.participants
      .filter(p => p.user.id !== user.id) // Не включаем самого пользователя в участники
      .map(p => p.user),
       comment: generateTaskComment(task),

  }));

  return res.status(200).json({ status: 'success', data: tasks });
};
export const User = async (req, res) => {
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }
  

  if (!req.params.id) {
    return res.status(400).json({ status: 'Invalid user ID' });
  }

  const targetUserId = String(req.params.id);

  const parsedUserId = parseInitData(initData)?.user?.id;
  const currentUser = await prisma.user.findFirst({
    where: { initData: String(parsedUserId) },
    select: { id: true }
  });

  if (!currentUser) {
    return res.status(404).json({ status: 'User not authorized' });
  }

  if (currentUser.id === targetUserId) {
    return res.status(400).json({ status: 'You cannot view your own profile with this endpoint' });
  }

  const user = await prisma.user.findFirst({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      icon: true,
      createdAt: true,
      updatedAt: true,
     rewards: {
  select: {
    id: true,
    title: true,
    description: true,
    userId:true
  }
},

      tasks: {
        select: {
          endTime: true,
          participants: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  icon: true
                }
              }
            }
          },
          status: true,
          timeout: true,
          title: true,
          type: true,
        }
      },
      friends: {
        where: { status: 'ACCEPTED' },
        select: {
          friend: {
            select: {
              id: true,
              name: true,
              icon: true
            }
          }
        }
      },
      friendOf: {
        where: { status: 'ACCEPTED' },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              icon: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({ status: 'User not found' });
  }

  // Объединяем друзей
  const allFriends = [
    ...(user.friends ?? []).map(f => f.friend),
    ...(user.friendOf ?? []).map(f => f.user)
  ];

  const { friends, friendOf, ...restUser } = user;

  // Считаем количество задач текущего пользователя по статусу
  const taskCounter = {
    cancelled: 0,
    in_progress: 0,
    completed: 0
  };

  for (const task of user.tasks) {
    if (task.status === 'CANCELLED') taskCounter.cancelled += 1;
    if (task.status === 'IN_PROGRESS') taskCounter.in_progress += 1;
    if (task.status === 'COMPLETED') taskCounter.completed += 1;
  }
// 1. Получаем общее количество пользователей
const totalUsers = await prisma.user.count();

// 2. Получаем награды текущего пользователя
const userRewards = user.rewards;

// 3. Для каждой награды считаем, у скольких пользователей она есть
const rewardIds = userRewards.map(r => r.id);

const rewardOccurrences = await prisma.rewards.groupBy({
  by: ['title'],
  where: {
    title: {
      in: userRewards.map(r => r.title)
    }
  },
  _count: {
    title: true
  }
});

// 4. Добавляем процент к каждой награде
const rewardsWithPercentage = userRewards.map(reward => {
  const found = rewardOccurrences.find(r => r.title === reward.title);
  const count = found?._count.title || 0;
  const percentage = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;

  return {
    ...reward,
    percentage
  };
});

  // Проверка, является ли targetUserId другом currentUser
  const friendRelation = await prisma.userFriend.findFirst({
    where: {
      OR: [
        { userId: currentUser.id, friendId: targetUserId },
        { userId: targetUserId, friendId: currentUser.id }
      ]
    },
    select: {
      status: true,
      userId: true,
      friendId: true,
      id: true
    }
  });

  let friendStatus = {
    status: false,
    side: null
  };

  if (!friendRelation) {
    friendStatus = false;
  } else if (friendRelation.status === 'PENDING' && friendRelation.userId === currentUser.id) {
    friendStatus = {
      status: 'PENDING',
      side: 'outgoing',
      id: friendRelation.id
    };
  } else if (friendRelation.status === 'PENDING' && friendRelation.friendId === currentUser.id) {
    friendStatus = {
      status: 'PENDING',
      side: 'incoming',
      id: friendRelation.id
    };
  } else if (friendRelation.status === 'ACCEPTED') {
    friendStatus = {
      status: 'ACCEPTED',
      id: friendRelation.id
    };
  }

  // Получаем количество задач у друзей
  const friendIds = allFriends.map(friend => friend.id);

  const tasksByFriend = await prisma.task.groupBy({
    by: ['userId'],
    where: {
      userId: { in: friendIds }
    },
    _count: {
      _all: true
    }
  });

  const friendTaskCounts = Object.fromEntries(
    tasksByFriend.map(t => [t.userId, t._count._all])
  );

  const friendsWithTaskCounts = allFriends.map(friend => ({
    ...friend,
    taskCount: friendTaskCounts[friend.id] || 0
  }));

  // Финальный ответ
 return res.status(200).json({
  status: 'success',
  data: {
    ...restUser,
    taskCounter,
    friend: friendStatus,
    friends: friendsWithTaskCounts,
    rewards: rewardsWithPercentage
  }
});

};

export const Top = async (req, res) => {
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  const parsedUserId = parseInitData(initData)?.user?.id;
  const userId = await prisma.user.findFirst({
    where: {
      initData: String(parsedUserId)
    }
  });

  if (!userId) {
    return res.status(404).json({ status: 'User not found' });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      icon: true,
      tasks: {
        select: { id: true },
      },
      taskParticipations: {
        select: {
          taskId: true,
        },
      },
    },
  });

  // Подсчет общего количества задач для каждого пользователя
  const top = users
    .map(user => {
      const taskIds = new Set([
        ...user.tasks.map(t => t.id),
        ...user.taskParticipations.map(p => p.taskId),
      ]);

      return {
        id: user.id,
        name: user.name,
        icon: user.icon,
        totalTasks: taskIds.size,
      };
    })
    .sort((a, b) => b.totalTasks - a.totalTasks); // Сортировка по убыванию

  // Находим текущего пользователя в топе
  const me = top.find(u => u.id === userId.id);

  // Если пользователь найден, добавляем его позицию (rank)
  if (me) {
    // Находим индекс пользователя в отсортированном массиве (+1, так как индексы начинаются с 0)
    me.rank = top.findIndex(u => u.id === userId.id) + 1;
  }

  return res.status(200).json({
    status: 'success',
    data: {
      top,
      me, // Теперь содержит { id, name, icon, totalTasks, rank }
    },
  });
};
export const FriendAdd = async (req, res) => {
  const id = req.params.id;
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  if (!id) {
    return res.status(400).json({ status: 'Invalid user ID' });
  }
const parsedUserId = parseInitData(initData)?.user?.id;
  const currentUser = await prisma.user.findFirst({
    where: { initData:String(parsedUserId) },
    select: { id: true,name:true }
  });

  if (!currentUser) {
    return res.status(404).json({ status: 'User not authorized' });
  }

  if (currentUser.id === id) {
    return res.status(400).json({ status: 'You cannot add yourself as a friend' });
  }

  
  const existing = await prisma.userFriend.findFirst({
    where: {
      OR: [
        { userId: currentUser.id, friendId: id },
        { userId: id, friendId: currentUser.id }
      ]
    }
  });

  if (existing) {
    return res.status(400).json({ status: 'Friend request already exists or already friends' });
  }

 const user = await prisma.user.findFirst({
  where: { id },});
  if (!user) {
    return res.status(404).json({ status: 'User not found' });
  }
const chatId = user.chatId;
  const add = await prisma.userFriend.create({
    data: {
      userId: currentUser.id,
      friendId: id,
      status: 'PENDING'
    }
  });
  const friendRequestId = add.id;
  
  await SendFriendRequest(chatId, friendRequestId,currentUser.name);

  return res.status(200).json({ status: 'success', data: add });
};
export const DeleteOrCancelFriend = async(req,res)=> {
  const id = req.params.id;
  const initData = req.headers['tg-init-data'];
  if (!initData) {
 
    
    return res.status(404).json({ status: 'initData is required' });
  }
  if (!id) {

    return res.status(400).json({ status: 'Invalid Friend ID' });
  }

 const check = await prisma.userFriend.findFirst({
  where:{
    id:id,
    
  }
 })
if(check) {
  const checkFriend = await prisma.userFriend.findFirst({
    where:{
      id:id
    }
  })

  const user = await prisma.user.findFirst({
where:{
  id:checkFriend.userId
}
  })
    if(checkFriend.status=='PENDING') {
  SendMessage('Ваш запрос на добавление в друзья был отменен', user.chatId);   
  }
  else if(checkFriend.status=='ACCEPTED') {
    SendMessage('Вы успешно удалили друга', user.chatId);   
  }
 
      
const del = await prisma.userFriend.delete({
  where: {
    id: id,
  },});
  
  res.status(200).json({ status: 'success'});
}
else {

  
  res.status(404).json({ status: 'Friend Relation not found' });
}
}
export const FriendAccept = async (req, res) => {
  const id = req.params.id;
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  if (!id) {
    return res.status(400).json({ status: 'Invalid Friend ID' });
  }

  const check = await prisma.userFriend.findFirst({
    where: { id }
  });

  if (!check) {
    return res.status(404).json({ status: 'Friend Relation not found' });
  }

  if (check.status === 'ACCEPTED') {
    return res.status(400).json({ status: 'Friend request already accepted' });
  }

  const accept = await prisma.userFriend.update({
    where: { id },
    data: { status: 'ACCEPTED' }
  });
const checkUser = await prisma.user.findFirst({
  where:{id:check.userId}
})
SendMessage('Ваш запрос на добавление в друзья был принят', checkUser.chatId);

  return res.status(200).json({ status: 'success', data: accept });
};

export const CancelTask = async (req, res) => {
  const id = req.params.id;
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  if (!id) {
    return res.status(400).json({ status: 'Invalid Task ID' });
  }
const parsedUserId = parseInitData(initData)?.user?.id;
  const currentUser = await prisma.user.findFirst({
    where: { initData:String(parsedUserId) },
  });

  if (!currentUser) {
    return res.status(404).json({ status: 'User not authorized' });
  }

  const userid = currentUser.id;

  const check = await prisma.task.findFirst({
    where: { id, userId: userid }
  });

  if (check) {
    if(check.status ==='COMPLETED') {

      return res.status(400).json({ status: 'Task already completed' });
    }
    if (check.status === 'CANCELLED') {
      return res.status(400).json({ status: 'Task already cancelled' });
    }
 function calcTimeout(endTime) {
    if (!endTime) return null;
    const nowStr = localISOStringWithZ();
const now = new Date(nowStr); 


const end = new Date(endTime);
    const diffMs = end.getTime() - now.getTime();
    return Math.floor(diffMs / 60000).toString();
  }
    const cancel = await prisma.task.update({
      where: { id },
      data: { status: 'CANCELLED',
        timeout: calcTimeout(check.endTime) ?? check.timeout,
       }
    });
SendMessage('Задача "' + cancel.title + '" была успешно отменена!', currentUser.chatId);
    return res.status(200).json({ status: 'success', data: cancel });
  } else {
    return res.status(404).json({ status: 'Task not found' });
  }
}
export const CompleteTask = async (req, res) => {
  const id = req.params.id;
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  if (!id) {
    return res.status(400).json({ status: 'Invalid Task ID' });
  }
const parsedUserId = parseInitData(initData)?.user?.id;
  const currentUser = await prisma.user.findFirst({
    where: { initData:String(parsedUserId) },
  });

  if (!currentUser) {
    return res.status(404).json({ status: 'User not authorized' });
  }

  const userid = currentUser.id;

  const check = await prisma.task.findFirst({
    where: { id, userId: userid },
    include: { participants: true },
  });

  if (!check) {
    return res.status(404).json({ status: 'Task not found' });
  }

  if (check.status === 'CANCELLED') {
    return res.status(400).json({ status: 'Task already cancelled' });
  }

  if (check.status === 'COMPLETED') {
    return res.status(400).json({ status: 'Task already completed' });
  }

  function calcTimeout(endTime) {
    if (!endTime) return null;
    const now = new Date();
    const end = new Date(endTime);
    const diffMs = end.getTime() - now.getTime();
    return Math.floor(diffMs / 60000).toString();
  }

  const timeout = calcTimeout(check.endTime);

  const complete = await prisma.task.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      timeout: timeout ?? check.timeout,
    },
  });

  // Участники + автор
  const allUserIds = [
    check.userId,
    ...check.participants.map(p => p.userId),
  ];
const nowStr = localISOStringWithZ();
  const now = new Date(nowStr);
  const createdAt = new Date(check.createdAt);
  const minutesSinceCreated = Math.floor((now - createdAt) / 60000);

  const rewards = [];

  // Базовая награда за выполнение
  rewards.push({
    title: `Задача "${check.title}" завершена!`,
    description: `Поздравляем с успешным выполнением задачи "${check.title}"`,
  });

  // Условная награда за скорость
  if (minutesSinceCreated <= 60) {
    rewards.push({
      title: 'Молниеносный',
      description: 'Ты завершил(а) задачу менее чем за 1 час!',
    });
  }

  // Создать награды всем участникам
  await Promise.all(
    allUserIds.flatMap(userId =>
      rewards.map(r =>
        prisma.rewards.create({
          data: {
            title: r.title,
            description: r.description,
            userId,
          },
        })
      )
    )
  );

  SendMessage(
    'Задача "' + complete.title + '" была успешно выполнена!',
    currentUser.chatId
  );

  return res.status(200).json({ status: 'success', data: complete });
};
export const Chart = async (req, res) => {
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }
const parsedUserId = parseInitData(initData)?.user?.id;
  const user = await prisma.user.findFirst({
    where: { initData:String(parsedUserId) },
    select: { id: true }
  });

  if (!user) {
    return res.status(404).json({ status: 'User not found' });
  }

  const userId = user.id;

  // Вспомогательная функция для сбора статистики по диапазону
  async function getTaskStats(startDate, days) {
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate
        }
      },
      select: { createdAt: true }
    });

    const counts= {};

    for (let i = 0; i <= days; i++) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      counts[date] = 0;
    }

    tasks.forEach(task => {
      const date = format(startOfDay(task.createdAt), "yyyy-MM-dd");
      if (counts[date] !== undefined) {
        counts[date]++;
      }
    });

    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  const [day, week, month] = await Promise.all([
    getTaskStats(subDays(new Date(), 1), 1),
    getTaskStats(subDays(new Date(), 7), 7),
    getTaskStats(subDays(new Date(), 30), 30),
  ]);

  return res.status(200).json({
    status: 'success',
    data: {
      day,
      week,
      month
    }
  });
};
export const AcceptTask =async (req, res)=> {
const id = req.params.id;
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  if (!id) {
    return res.status(400).json({ status: 'Invalid Friend ID' });
  }

  const check = await prisma.taskParticipant.findFirst({
    where: { id }
  });

  if (!check) {
    return res.status(404).json({ status: 'Task not found' });
  }

  if (check.status === 'ACCEPTED') {
    return res.status(400).json({ status: 'Task request already accepted' });
  }

  const accept = await prisma.taskParticipant.update({
    where: { id },
    data: { status: 'ACCEPTED' }
  });
const checkUser = await prisma.user.findFirst({
  where:{id:check.userId}
})
SendMessage('Ваш запрос на добавление в таск был принят', checkUser.chatId);

  return res.status(200).json({ status: 'success', data: accept });
}
export const RejectTask = async(req, res)=> {
  const id = req.params.id;
  const initData = req.headers['tg-init-data'];

  if (!initData) {
    return res.status(404).json({ status: 'initData is required' });
  }

  if (!id) {
    return res.status(400).json({ status: 'Invalid Friend ID' });
  }

  const check = await prisma.taskParticipant.findFirst({
    where: { id }
  });

  if (!check) {
    return res.status(404).json({ status: 'Task not found' });
  }

  if (check.status === 'ACCEPTED') {
    return res.status(400).json({ status: 'Task request already accepted' });
  }

  const accept = await prisma.taskParticipant.delete({
    where: { id },

  });
const checkUser = await prisma.user.findFirst({
  where:{id:check.userId}
})
SendMessage('Ваш запрос на добавление в таск был отказан', checkUser.chatId);

  return res.status(200).json({ status: 'success', data: accept });
}