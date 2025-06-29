require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const routes = require("./routes");
const { Attendance } = require("./models");
const cron = require("node-cron");

const app = express();

const allowedOrigins = [
  "https://nxtwave-frontend-eight.vercel.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `CORS policy does not allow access from origin ${origin}`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// Connect MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/api", routes);

// Daily cleanup cron job
cron.schedule("0 2 * * *", async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 10);

    const result = await Attendance.deleteMany({
      checkInTime: { $lt: cutoffDate },
    });

    console.log(
      `[Cleanup Job] Deleted ${result.deletedCount} attendance records older than 10 days`
    );
  } catch (error) {
    console.error(
      "[Cleanup Job] Error deleting old attendance records:",
      error
    );
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
