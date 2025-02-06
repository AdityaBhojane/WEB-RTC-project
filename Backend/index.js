import { Server } from "socket.io";

const io = new Server(8000,{
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const emailToSocket = new Map();
const socketToEmail = new Map();

io.on("connection", (socket) => {
    console.log('scoket connected', socket);
    socket.on("join-room", data =>{
        console.log(data);
        emailToSocket.set(data.email, socket);
        socketToEmail.set(socket, data.email);
        io.to(socket.id).emit("join-room", data)
    })
});
