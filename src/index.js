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
  transports: ["websocket", "polling"],
  path: "/socket.io"
});

const message = []
const users = []

// Game area boundaries (adjust based on your container size)
const GAME_WIDTH = 1400
const GAME_HEIGHT = 600
const BUBBLE_SIZE = 56 // 14 * 4 = 56px (size-14 in Tailwind)

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("habar", (malumot, ack) => {
    console.log("from:", socket.id, "data:", malumot);
    message.push(malumot)
    io.emit("message", message);
  });

  socket.on("join_game", (malumot) => {
    console.log("from:", socket.id, "data:", malumot);
    
    // Check if user already exists
    const existingUser = users.find(item => item.name === malumot.name)
    
    if (!existingUser) {
      // Add new user with random starting position
      const newUser = {
        name: malumot.name,
        id: socket.id,
        x: Math.random() * (GAME_WIDTH - BUBBLE_SIZE) + BUBBLE_SIZE/2,
        y: Math.random() * (GAME_HEIGHT - BUBBLE_SIZE) + BUBBLE_SIZE/2
      }
      users.push(newUser)
    }
    
    io.emit("new_user", users)
  })

  socket.on("move_user", (movement) => {
    const userIndex = users.findIndex(user => user.id === socket.id)
    
    if (userIndex !== -1) {
      const user = users[userIndex]
      
      // Calculate new position
      let newX = user.x + movement.deltaX
      let newY = user.y + movement.deltaY
      
      // Boundary checking
      newX = Math.max(BUBBLE_SIZE/2, Math.min(GAME_WIDTH - BUBBLE_SIZE/2, newX))
      newY = Math.max(BUBBLE_SIZE/2, Math.min(GAME_HEIGHT - BUBBLE_SIZE/2, newY))
      
      // Update user position
      users[userIndex].x = newX
      users[userIndex].y = newY
      
      // Emit updated positions to all clients
      io.emit("user_moved", users)
    }
  })

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, reason);
    
    // Remove user from users array
    const userIndex = users.findIndex(user => user.id === socket.id)
    if (userIndex !== -1) {
      users.splice(userIndex, 1)
      io.emit("new_user", users) // Update all clients
    }
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));