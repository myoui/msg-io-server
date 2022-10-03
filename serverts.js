"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const crypto_1 = __importDefault(require("crypto"));
const PORT = process.argv[2] ? parseInt(process.argv[2]) : 8080;
const app = (0, express_1.default)();
app.use(cors_1.default);
const server = http_1.default.createServer(app);
// const { Server } = require("socket.io");
const randomId = () => crypto_1.default.randomBytes(8).toString("hex");
const io = new socket_io_1.Server(server, {
    cors: { 'origin': '*' }
});
var userList = [];
class SessionStore {
    constructor() {
        this.sessions = new Map();
        this.sessions.set('TEST', {
            userID: '12345',
            username: 'admin'
        });
    }
    findSession(id) {
        return this.sessions.get(id);
    }
    saveSession(id, session) {
        this.sessions.set(id, session);
    }
    findAllSessions() {
        return [...this.sessions.values()];
    }
}
const currentSessions = new SessionStore();
console.log(currentSessions.findSession('TEST'));
app.get('/', (req, res) => {
    res.send('Socket io server');
});
const updateUserList = () => {
    io.emit('userList', userList.map((socket) => socket.data.username + '//' + socket.data.userID).join('(*)'));
};
const updateUsers = setInterval(() => {
    updateUserList();
}, 20000);
io.use((socket, next) => {
    const sessionID = socket.handshake.auth.sessionID;
    if (sessionID) {
        console.log(`Found existing session ${sessionID}`);
        const session = currentSessions.findSession(sessionID);
        if (session) {
            console.log('Got session from storage');
            socket.data.sessionID = sessionID;
            socket.data.userID = session.userID;
            socket.data.username = session.username;
        }
        return next();
    }
    console.log('New user block');
    const username = socket.handshake.auth.username;
    if (!username) {
        return next(new Error("invalid username"));
    }
    socket.data.sessionID = randomId();
    socket.data.userID = randomId();
    socket.data.username = username; // DATA FIELD
    console.log(`${socket.data.userID} ${username} created.`);
    next();
});
io.on('connection', (socket) => {
    console.log(`${socket.data.username} connected`);
    if (!userList.includes(socket)) {
        userList.push(socket);
    }
    console.log(userList.map((socket) => socket.data.username));
    socket.broadcast.emit('message', {
        username: 'SYSTEM',
        msg: `${socket.data.username} has logged on.`
    });
    socket.emit('message', {
        username: 'SYSTEM',
        msg: `You have logged on.`
    });
    socket.emit('session', {
        sessionID: socket.data.sessionID,
        userID: socket.data.userID
    });
    updateUserList();
    socket.on('sysMsg', (arg) => {
        console.log(`${socket.conn.remoteAddress}: ${arg}`);
    });
    socket.on('message', (arg) => {
        console.log(`message:(${arg.uid}) ${arg.username}: ${arg.msg}`);
        socket.broadcast.emit('message', arg);
    });
    socket.on('disconnect', () => {
        currentSessions.saveSession(socket.data.sessionID, {
            userID: socket.data.userID,
            username: socket.data.username
        });
        console.log(`Saved session for UID ${socket.data.userID}`);
        currentSessions.findSession(socket.data.sessionID);
        let i = userList.indexOf(socket);
        userList.splice(i, 1);
        socket.broadcast.emit('message', {
            username: 'SYSTEM',
            msg: `${socket.data.username} has logged off.`
        });
        console.log(`${socket.data.username} disconnected`);
        updateUserList();
        console.log(userList.map((socket) => socket.data.username));
    });
});
server.listen(PORT, () => {
    console.log(`listening on ${PORT}`);
});
