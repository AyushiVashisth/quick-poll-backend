const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connection = require("./config/db");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust as needed for security
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Poll Schema
const pollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [
    {
      text: { type: String, required: true },
      votes: { type: Number, default: 0 },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const Poll = mongoose.model("Poll", pollSchema);

// WebSocket connection
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// API Routes

// Create a new poll
app.post("/api/polls", async (req, res) => {
  try {
    const { question, options } = req.body;
    const poll = new Poll({
      question,
      options: options.map((opt) => ({ text: opt, votes: 0 })),
    });
    await poll.save();

    io.emit("pollsUpdated", poll); // Notify all clients about the new poll
    res.status(201).json(poll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all polls
app.get("/api/polls", async (req, res) => {
  try {
    const polls = await Poll.find().sort({ createdAt: -1 });
    res.json(polls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote on a poll
app.post("/api/polls/:id/vote", async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    poll.options[optionIndex].votes += 1;
    await poll.save();

    io.emit("pollsUpdated", poll); // Notify all clients about the updated poll

    res.json(poll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start Server
server.listen(process.env.PORT || 5000, async () => {
  try {
    console.log("Listening on port " + (process.env.PORT || 5000));
    await connection;
    console.log("Successfully connected to MongoDB Atlas");
  } catch (error) {
    console.log(error);
  }
});
