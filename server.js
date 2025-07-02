require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const routes = require("./routes");
const { Attendance } = require("./models");
const cron = require("node-cron");

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "https://nxtwave-frontend-eight.vercel.app",
      "http://localhost:3001",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api", routes);

// Test endpoint
app.get("/", (req, res) => {
  res.send("Attendance System API");
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Cron job
cron.schedule("0 2 * * *", async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 10);
    const result = await Attendance.deleteMany({
      checkInTime: { $lt: cutoffDate },
    });
    console.log(`Deleted ${result.deletedCount} old records`);
  } catch (error) {
    console.error("Cleanup error:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
