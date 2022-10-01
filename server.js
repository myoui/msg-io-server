const express = require('express');
const http = require('http');
const cors = require('cors')


const HOST = 'https://localhost'
const PORT = process.argv[2] ? process.argv[2] : 8080

const app = express();
app.use(cors)
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {'origin': '*'}
  }
);

app.get('/', (req, res) => {
  res.send('Socket io server');
});

var userListObjects = []
var userList = []

const updateUserList = () => {
  io.emit('userList',userList.map((socket) => socket.username).join('(*)'))
}
const updateUsers = setInterval(() => {
  // console.log(userList.map((socket) => socket.username))
  // console.log(io.sockets.allSockets())
  updateUserList()
  // console.log(userList.map((socket) => socket.username).join('(*)'))
}, 20000);


io.use((socket, next) => {
  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("invalid username"))
  }
  socket.username = username
  console.log(`${socket.id} ${username} logged in.`)
  next()
})

io.on('connection', (socket) => {
  console.log(`${socket.username} connected`)
  if (!userList.includes(socket)) {
    userList.push(socket)
  }
  console.log(userList.map((socket) => socket.username))
  
  socket.broadcast.emit('message',{
    username: 'SYSTEM',
    msg: `${socket.username} has logged on.`
  })
  socket.emit('message',{
    username: 'SYSTEM',
    msg: `You have logged on.`
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
    let i = userList.indexOf(socket)
    userList.splice(i, 1)
    socket.broadcast.emit('message',{
      username: 'SYSTEM',
      msg: `${socket.username} has logged off.`
    })
    console.log(`${socket.username} disconnected`)
    updateUserList()
    console.log(userList.map((socket) => socket.username))
  })
});

server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
