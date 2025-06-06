import express from 'express';
import {CreateTask, GetUsers, Report, Search, Welcome } from './routes/post.js';
import cors from 'cors'
import { CancelTask, Chart, CompleteTask, DeleteOrCancelFriend, FriendAccept, FriendAdd, Friends, Tasks, Top, User } from './routes/get.js';


const app = express();
app.use(cors({
  origin: ['http://localhost:3000','https://task-battle.vercel.app/'],
  credentials: true // если используешь куки, авторизацию и т.д.
}));
app.use(express.json());
/// post
app.post('/api/user/welcome',Welcome)
app.post('/api/user/search',Search)
app.post('/api/user/report',Report)
app.post('/api/task/create',CreateTask)
app.post('/api/admin/users',GetUsers)

/// get
app.get('/api/user/friends',Friends)
app.get('/api/user/tasks',Tasks)
app.get('/api/users/:id',User)  
app.get('/api/user/top',Top)
app.get('/api/user/friend/add/:id',FriendAdd)
app.get('/api/user/friend/deleteOrCancel/:id',DeleteOrCancelFriend)
app.get('/api/user/friend/accept/:id',FriendAccept)
app.get('/api/user/task/complete/:id',CompleteTask)
app.get('/api/user/task/cancel/:id',CancelTask)
app.get('/api/user/chart',Chart) 
app.listen(process.env.PORT)