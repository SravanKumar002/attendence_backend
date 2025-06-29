require("dotenv").config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const { Employee, Attendance } = require("./models");
const { calculateDistance } = require("./utils");

// Helper function to delete attendance by date
const deleteAttendanceForDate = async (dateString) => {
  try {
    const start = new Date(dateString);
    start.setHours(0, 0, 0, 0);

    const end = new Date(dateString);
    end.setHours(23, 59, 59, 999);

    const result = await Attendance.deleteMany({
      checkInTime: { $gte: start, $lte: end },
    });

    console.log(
      `Deleted ${result.deletedCount} attendance records for date ${dateString}`
    );
    return result.deletedCount;
  } catch (error) {
    console.error("Error deleting attendance for date:", error);
    throw error;
  }
};

function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  console.log("AUTH HEADER:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  if (!token || token === "null") {
    return res.status(401).json({ error: "Token missing or invalid" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("Auth error:", err.message);
      return res.status(403).json({ error: "Invalid token" });
    }

    req.user = decoded;
    next();
  });
}

// Register route
router.post(
  "/register",
  [
    body("employeeId").notEmpty(),
    body("name").notEmpty(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { employeeId, name, password, department, position } = req.body;

      const existing = await Employee.findOne({ employeeId });
      if (existing) {
        return res.status(400).json({ error: "Employee ID already exists" });
      }

      const hashed = await bcrypt.hash(password, 10);
      const employee = new Employee({
        employeeId,
        name,
        password: hashed,
        department,
        position,
      });

      await employee.save();

      const token = jwt.sign({ employeeId }, process.env.JWT_SECRET);
      res.status(201).json({ employee, token });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Server error during registration" });
    }
  }
);

// Login route
router.post("/login", async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ employeeId }, process.env.JWT_SECRET);
    res.json({ employee, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Check-in route
router.post(
  "/checkin",
  authenticate,
  [
    body("status").notEmpty(),
    body("latitude").if(body("status").equals("present")).isFloat(),
    body("longitude").if(body("status").equals("present")).isFloat(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status, latitude, longitude, notes } = req.body;

      const employee = await Employee.findOne({
        employeeId: req.user.employeeId,
      });

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const existing = await Attendance.findOne({
        employeeId: employee.employeeId,
        checkInTime: { $gte: todayStart, $lte: todayEnd },
      });

      if (existing) {
        return res
          .status(400)
          .json({ error: "You have already checked in today" });
      }

      let distance = null;
      let location;

      if (status === "present") {
        if (latitude == null || longitude == null) {
          return res
            .status(400)
            .json({ error: "Latitude and longitude required" });
        }

        const officeLocations = JSON.parse(
          process.env.OFFICE_LOCATIONS || "[]"
        );

        if (!Array.isArray(officeLocations) || officeLocations.length === 0) {
          return res
            .status(500)
            .json({ error: "Office locations not configured" });
        }

        let withinRange = false;

        for (const office of officeLocations) {
          const dist = calculateDistance(
            latitude,
            longitude,
            parseFloat(office.lat),
            parseFloat(office.lng)
          );

          if (dist <= 100) {
            distance = dist;
            withinRange = true;
            break;
          }
        }

        if (!withinRange) {
          return res
            .status(400)
            .json({ error: "Not within 100 meters of office" });
        }

        location = {
          type: "Point",
          coordinates: [longitude, latitude],
        };
      } else {
        // Default location for other statuses
        location = {
          type: "Point",
          coordinates: [78.486671, 17.385044],
        };
      }

      const attendance = new Attendance({
        employeeId: employee.employeeId,
        checkInTime: new Date(),
        status,
        location,
        distance,
        notes,
      });

      await attendance.save();

      employee.lastCheckIn = new Date();
      await employee.save();

      res.json({
        attendance,
        ...(distance != null && { distance }),
      });
    } catch (error) {
      console.error("Check-in error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Profile route
router.get("/me", authenticate, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      employeeId: req.user.employeeId,
    });
    res.json(employee);
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get attendance records for logged-in user
router.get("/attendance", authenticate, async (req, res) => {
  try {
    const records = await Attendance.find({
      employeeId: req.user.employeeId,
    }).sort({ checkInTime: -1 });

    res.json(records);
  } catch (error) {
    console.error("Attendance fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin login
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });
      return res.json({ token });
    } else {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin get all attendance with optional date filter (defaults to today)
router.get("/admin/attendance", authenticate, async (req, res) => {
  try {
    let { date } = req.query;

    let start, end;

    if (date) {
      start = new Date(date);
      start.setHours(0, 0, 0, 0);

      end = new Date(date);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default to today
      start = new Date();
      start.setHours(0, 0, 0, 0);

      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const records = await Attendance.aggregate([
      {
        $match: {
          checkInTime: { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "employeeId",
          as: "employeeDetails",
        },
      },
      { $unwind: "$employeeDetails" },
      {
        $project: {
          employeeId: 1,
          checkInTime: 1,
          status: 1,
          distance: 1,
          employeeName: "$employeeDetails.name",
        },
      },
      { $sort: { checkInTime: -1 } },
      { $limit: 100 },
    ]);

    res.json(records);
  } catch (error) {
    console.error("Admin attendance error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE attendance records for a particular date (admin only)
router.delete("/admin/attendance", authenticate, async (req, res) => {
  try {
    if (!req.user.admin) {
      return res.status(403).json({ error: "Forbidden: Admins only" });
    }

    const { date } = req.query;
    if (!date) {
      return res
        .status(400)
        .json({ error: "Date query parameter is required" });
    }

    if (isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const deletedCount = await deleteAttendanceForDate(date);

    res.json({
      message: `Deleted ${deletedCount} attendance records for ${date}`,
    });
  } catch (error) {
    console.error("Delete attendance error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
