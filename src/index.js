// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://one087-socket-multiplayer.onrender.com/"],
    methods: ["GET","POST"],
    credentials: false,
  },
  transports: ["websocket", "polling"],
  path: "/socket.io"
});

const message = []
const users = []

// Game area boundaries
const GAME_WIDTH = 1400
const GAME_HEIGHT = 600
const MIN_BUBBLE_SIZE = 56 // Minimum size (size-14 in Tailwind)
const MAX_BUBBLE_SIZE = 200 // Maximum size
const EAT_RADIUS = 20 // Food collision radius
const PLAYER_EAT_MULTIPLIER = 0.8 // How close players need to be to eat each other

// Food management - now on server side
let currentFood = {
  x: Math.floor(Math.random() * GAME_WIDTH),
  y: Math.floor(Math.random() * GAME_HEIGHT)
}

const generateNewFood = () => {
  currentFood = {
    x: Math.floor(Math.random() * GAME_WIDTH),
    y: Math.floor(Math.random() * GAME_HEIGHT)
  }
}

// Calculate bubble size based on score
const calculateBubbleSize = (score) => {
  return Math.min(MIN_BUBBLE_SIZE + (score * 8), MAX_BUBBLE_SIZE)
}

// Calculate bubble radius for collision detection
const getBubbleRadius = (score) => {
  return calculateBubbleSize(score) / 2
}

const checkFoodCollision = (userX, userY) => {
  const dx = userX - currentFood.x
  const dy = userY - currentFood.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  return distance <= EAT_RADIUS
}

// Check if one player can eat another
const checkPlayerCollision = (player1, player2) => {
  const dx = player1.x - player2.x
  const dy = player1.y - player2.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  const p1Radius = getBubbleRadius(player1.score)
  const p2Radius = getBubbleRadius(player2.score)
  
  // Check if they're touching and one is significantly bigger
  const touchingDistance = (p1Radius + p2Radius) * PLAYER_EAT_MULTIPLIER
  
  if (distance <= touchingDistance) {
    // Player 1 can eat player 2 if player 1 has more score
    if (player1.score > player2.score) {
      return { canEat: true, eater: player1, victim: player2 }
    }
    // Player 2 can eat player 1 if player 2 has more score  
    else if (player2.score > player1.score) {
      return { canEat: true, eater: player2, victim: player1 }
    }
  }
  
  return { canEat: false }
}

// Respawn player at random location
const respawnPlayer = (player) => {
  const bubbleSize = calculateBubbleSize(0) // Reset size
  player.x = Math.random() * (GAME_WIDTH - bubbleSize) + bubbleSize/2
  player.y = Math.random() * (GAME_HEIGHT - bubbleSize) + bubbleSize/2
  player.score = 0
}

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
      const bubbleSize = calculateBubbleSize(0)
      // Add new user with random starting position and score
      const newUser = {
        name: malumot.name,
        id: socket.id,
        x: Math.random() * (GAME_WIDTH - bubbleSize) + bubbleSize/2,
        y: Math.random() * (GAME_HEIGHT - bubbleSize) + bubbleSize/2,
        score: 0
      }
      users.push(newUser)
    }
    
    // Send current game state to new user
    io.emit("new_user", users)
    io.emit("food_update", currentFood)
  })

  socket.on("move_user", (movement) => {
    const userIndex = users.findIndex(user => user.id === socket.id)
    
    if (userIndex !== -1) {
      const user = users[userIndex]
      const bubbleSize = calculateBubbleSize(user.score)
      
      // Calculate new position
      let newX = user.x + movement.deltaX
      let newY = user.y + movement.deltaY
      
      // Boundary checking with dynamic bubble size
      newX = Math.max(bubbleSize/2, Math.min(GAME_WIDTH - bubbleSize/2, newX))
      newY = Math.max(bubbleSize/2, Math.min(GAME_HEIGHT - bubbleSize/2, newY))
      
      // Update user position
      users[userIndex].x = newX
      users[userIndex].y = newY
      
      // Check food collision
      if (checkFoodCollision(newX, newY)) {
        // Increase score
        users[userIndex].score += 1
        
        // Generate new food
        generateNewFood()
        
        console.log(`${user.name} ate food! Score: ${users[userIndex].score}`)
        
        // Notify all clients about food eaten and new food position
        io.emit("food_eaten", {
          playerId: socket.id,
          playerName: user.name,
          newScore: users[userIndex].score,
          newFood: currentFood
        })
      }
      
      // Check player collisions
      const currentPlayer = users[userIndex]
      let someoneWasEaten = false
      
      for (let i = 0; i < users.length; i++) {
        if (i !== userIndex) {
          const otherPlayer = users[i]
          const collision = checkPlayerCollision(currentPlayer, otherPlayer)
          
          if (collision.canEat) {
            const eaterIndex = users.findIndex(u => u.id === collision.eater.id)
            const victimIndex = users.findIndex(u => u.id === collision.victim.id)
            
            // Add victim's score to eater
            const victimScore = users[victimIndex].score
            users[eaterIndex].score += victimScore
            
            // Respawn victim
            respawnPlayer(users[victimIndex])
            
            console.log(`${collision.eater.name} (${users[eaterIndex].score - victimScore} -> ${users[eaterIndex].score}) ate ${collision.victim.name} (${victimScore})`)
            
            // Notify all clients about player being eaten
            io.emit("player_eaten", {
              eaterId: collision.eater.id,
              eaterName: collision.eater.name,
              eaterNewScore: users[eaterIndex].score,
              victimId: collision.victim.id,
              victimName: collision.victim.name,
              victimOldScore: victimScore
            })
            
            someoneWasEaten = true
            break // Only one eat per move to prevent multiple simultaneous eats
          }
        }
      }
      
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