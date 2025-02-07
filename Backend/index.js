import { Server } from "socket.io";

const io = new Server(8000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const emailToSocket = new Map();
const socketToEmail = new Map();

io.on("connection", (socket) => {
//   console.log("socket connected", socket);
  socket.on("join-room", (data) => {
    console.log(data);
    emailToSocket.set(data.email, socket);
    socketToEmail.set(socket, data.email);
    io.to(data.room).emit("user-joined", { email: data.email, id: socket.id });
    socket.join(data.room);
    io.to(socket.id).emit("join-room", data);
  });

  // Incoming call handle
  socket.on("user-call", ({ offer, to }) => {
    console.log("user-call", to);
    io.to(to).emit("incoming-call", { offer, from: socket.id });
  });

  // Answer call ( for one who received call )
  socket.on("call-accepted", ({ to, ans }) => {
    console.log('call accepted', ans);
    io.to(to).emit("call-accepted", { from: socket.id, ans });
  });

  // Call negotiation needed
  socket.on("peer-negotiation-needed", ({ to, offer }) => {
    console.log("peer-negotiation-needed", offer);
    io.to(to).emit("peer-negotiation-needed", { from: socket.id, offer });
  });

  // Call negotiation done
  socket.on("peer-negotiation-done", ({ to, ans }) => {
    console.log("peer-negotiation-done", ans);
    io.to(to).emit("peer-negotiation-final", { from: socket.id, ans });
  });

}); 
