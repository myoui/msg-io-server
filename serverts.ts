import express, { Express, Request, Response } from 'express'
import http from 'http'
import cors from 'cors'
import { Server, Socket } from 'socket.io'
import crypto from 'crypto'


const PORT: number = process.argv[2] ? parseInt(process.argv[2]) : 8080

const app: Express = express();
app.use(cors)
const server = http.createServer(app);
// const { Server } = require("socket.io");
const randomId = () => crypto.randomBytes(8).toString("hex")

interface ServerToClientEvents {
    noArg: () => void;
    basicEmit: (a: number, b: string, c: Buffer) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
    userList: (a: string) => void;
    message: (a: any) => void;
    session: (a: any) => void;
  }  
interface ClientToServerEvents {
    hello: () => void;
    message: (a: any) => void;
    sysMsg: (a: string) => void;
}
interface InterServerEvents {
    ping: () => void;
}
interface SocketData {
    username: string;
    sessionID: string;
    userID: string;
}


const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
  cors: {'origin': '*'}
  }
);


var userList: Array<Socket> = []

class SessionStore {
  sessions: Map<string,any>

  constructor() {
    this.sessions = new Map();
    this.sessions.set('TEST',{
      userID:'12345',
      username:'admin'
    })
  }
  findSession(id:any) {
    return this.sessions.get(id);
  }
  saveSession(id:any, session:any) {
    this.sessions.set(id, session);
  }
  findAllSessions() {
    return [...this.sessions.values()];
  }
} 

const currentSessions = new SessionStore()
console.log(currentSessions.findSession('TEST'))

app.get('/', (req: Request, res: Response) => {
    res.send('Socket io server');
  });
  
const updateUserList = () => {
  io.emit('userList', userList.map((socket) => socket.data.username+'//'+socket.id).join('(*)'))
}
const updateUsers = setInterval(() => {
  updateUserList()
}, 20000);

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID
  if (sessionID) {
    console.log(`Found existing session ${sessionID}`)
    const session = currentSessions.findSession(sessionID)
    if (session) {
      console.log('Got session from storage')
      socket.data.sessionID = sessionID
      socket.data.userID = session.userID
      socket.data.username = session.username
    }
    return next()
  }

  console.log('New user block')
  const username:string = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("invalid username"))
  }
  socket.data.sessionID = randomId()
  socket.data.userID = randomId()
  socket.data.username = username // DATA FIELD
  console.log(`${socket.data.userID} ${username} created.`)
  next()
})

io.on('connection', (socket) => {
  console.log(`${socket.data.username} connected`)
  if (!userList.includes(socket)) {
    userList.push(socket)
  }
  console.log(userList.map((socket) => socket.data.username))
  
  socket.broadcast.emit('message',{
    username: 'SYSTEM',
    msg: `${socket.data.username} has logged on.`
  })
  socket.emit('message',{
    username: 'SYSTEM',
    msg: `You have logged on.`
  })
  socket.emit('session',{
    sessionID : socket.data.sessionID,
    userID : socket.data.userID
  })
  updateUserList()

  socket.on('sysMsg',(arg) =>{
    console.log(`${socket.conn.remoteAddress}: ${arg}`)
  })
  socket.on('message',(arg)=>{
    console.log(`message:(${arg.uid}) ${arg.username}: ${arg.msg}`)
    socket.broadcast.emit('message', arg)
  })

  socket.on('disconnect',() => {
    currentSessions.saveSession(socket.data.sessionID, {
      userID: socket.data.userID,
      username: socket.data.username
    })
    console.log(`Saved session for UID ${socket.data.userID}`)

    currentSessions.findSession(socket.data.sessionID)

    let i = userList.indexOf(socket)
    userList.splice(i, 1)
    socket.broadcast.emit('message',{
      username: 'SYSTEM',
      msg: `${socket.data.username} has logged off.`
    })
    console.log(`${socket.data.username} disconnected`)
    updateUserList()
    console.log(userList.map((socket) => socket.data.username))
  })
});

server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
