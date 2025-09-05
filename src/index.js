// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET","POST"],
    credentials: false,
  },
  transports: ["websocket", "polling"], // ixtiyoriy
  path: "/socket.io" // default
});

const message = []
const users = []

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("habar", (malumot, ack) => {
    console.log("from:", socket.id, "data:", malumot);
    message.push(malumot)
    io.emit("message", message);
  });

  socket.on("join_game", (malumot) => {
    console.log("from:", socket.id, "data:", malumot);
    
    users.find(item => item.name === malumot.name) ? null : users.push({ name: malumot.name, id: socket.id, x: 0, y: 0 })
    io.emit("new_user", users) // [{name: "Ibrohim"}]
  })

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, reason);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
