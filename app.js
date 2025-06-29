// require("dotenv").config();
// const express = require("express");
// const mongoose = require("mongoose");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const cors = require("cors");
// const { body, validationResult } = require("express-validator");

// const app = express();
// app.use(express.json());
// app.use(cors());

// // Connect to MongoDB
// mongoose
//   .connect(process.env.MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((err) => console.error("MongoDB connection error:", err));

// // Employee Schema
// const employeeSchema = new mongoose.Schema({
//   employeeId: { type: String, required: true, unique: true },
//   name: { type: String, required: true },
//   password: { type: String, required: true },
//   department: String,
//   position: String,
//   lastCheckIn: Date,
// });

// // Attendance Schema
// const attendanceSchema = new mongoose.Schema({
//   employeeId: { type: String, required: true },
//   date: { type: Date, default: Date.now },
//   checkInTime: { type: Date, required: true },
//   location: {
//     type: { type: String, default: "Point" },
//     coordinates: { type: [Number], required: true },
//   },
//   status: {
//     type: String,
//     enum: [
//       "present",
//       "late",
//       "absent",
//       "bootcamp",
//       "workshop",
//       "deployment",
//       "on leave",
//       "absent - sick",
//       "absent - personal",
//     ],
//     default: "present",
//   },
//   distance: Number,
// });

// // Create 2dsphere index for location queries
// attendanceSchema.index({ location: "2dsphere" });

// const Employee = mongoose.model("Employee", employeeSchema);
// const Attendance = mongoose.model("Attendance", attendanceSchema);

// // Helper to calculate distance (Haversine)
// function calculateDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371e3; // meters
//   const φ1 = (lat1 * Math.PI) / 180;
//   const φ2 = (lat2 * Math.PI) / 180;
//   const Δφ = ((lat2 - lat1) * Math.PI) / 180;
//   const Δλ = ((lon2 - lon1) * Math.PI) / 180;

//   const a =
//     Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
//     Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

//   return R * c;
// }

// // Auth middleware
// const authenticate = async (req, res, next) => {
//   const token = req.header("Authorization")?.replace("Bearer ", "");
//   if (!token) {
//     return res.status(401).send({ error: "Authentication required" });
//   }
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const employee = await Employee.findOne({ employeeId: decoded.employeeId });
//     if (!employee) throw new Error();
//     req.employee = employee;
//     next();
//   } catch (err) {
//     res.status(401).send({ error: "Invalid authentication token" });
//   }
// };

// // Register
// app.post(
//   "/api/register",
//   [
//     body("employeeId").notEmpty(),
//     body("name").notEmpty(),
//     body("password").isLength({ min: 6 }),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty())
//       return res.status(400).json({ errors: errors.array() });

//     try {
//       const { employeeId, name, password, department, position } = req.body;

//       const existing = await Employee.findOne({ employeeId });
//       if (existing)
//         return res.status(400).send({ error: "Employee ID already exists" });

//       const hashed = await bcrypt.hash(password, 10);

//       const employee = new Employee({
//         employeeId,
//         name,
//         password: hashed,
//         department,
//         position,
//       });

//       await employee.save();

//       const token = jwt.sign({ employeeId }, process.env.JWT_SECRET);

//       res.status(201).send({ employee, token });
//     } catch (err) {
//       res.status(400).send({ error: err.message });
//     }
//   }
// );

// // Login
// app.post("/api/login", async (req, res) => {
//   try {
//     const { employeeId, password } = req.body;
//     const employee = await Employee.findOne({ employeeId });
//     if (!employee)
//       return res.status(401).send({ error: "Invalid credentials" });

//     const isMatch = await bcrypt.compare(password, employee.password);
//     if (!isMatch) return res.status(401).send({ error: "Invalid credentials" });

//     const token = jwt.sign({ employeeId }, process.env.JWT_SECRET);
//     res.send({ employee, token });
//   } catch (err) {
//     res.status(400).send({ error: err.message });
//   }
// });

// //Check-In Route
// // app.post(
// //   "/api/checkin",
// //   authenticate,
// //   [
// //     body("status").notEmpty(),
// //     body("latitude").if(body("status").equals("present")).isFloat(),
// //     body("longitude").if(body("status").equals("present")).isFloat(),
// //   ],
// //   async (req, res) => {
// //     const errors = validationResult(req);
// //     if (!errors.isEmpty())
// //       return res.status(400).json({ errors: errors.array() });

// //     try {
// //       const { status, latitude, longitude } = req.body;
// //       const employee = req.employee;

// //       // Check if already checked in today
// //       const todayStart = new Date();
// //       todayStart.setHours(0, 0, 0, 0);
// //       const todayEnd = new Date();
// //       todayEnd.setHours(23, 59, 59, 999);

// //       const existing = await Attendance.findOne({
// //         employeeId: employee.employeeId,
// //         date: { $gte: todayStart, $lte: todayEnd },
// //       });

// //       if (existing) {
// //         return res
// //           .status(400)
// //           .send({ error: "You have already checked in today" });
// //       }

// //       let distance = null;

// //       if (status === "present") {
// //         if (latitude == null || longitude == null) {
// //           return res
// //             .status(400)
// //             .send({ error: "Location required for office check-in" });
// //         }

// //         distance = calculateDistance(
// //           latitude,
// //           longitude,
// //           parseFloat(process.env.OFFICE_LATITUDE),
// //           parseFloat(process.env.OFFICE_LONGITUDE)
// //         );

// //         if (distance > 300) {
// //           return res.status(400).send({
// //             error: "You must be within 300 meters of the office to check in",
// //           });
// //         }
// //       }

// //       const attendance = new Attendance({
// //         employeeId: employee.employeeId,
// //         checkInTime: new Date(),
// //         status,
// //         ...(status === "present" && {
// //           location: {
// //             type: "Point",
// //             coordinates: [longitude, latitude],
// //           },
// //           distance,
// //         }),
// //       });

// //       await attendance.save();

// //       employee.lastCheckIn = new Date();
// //       await employee.save();

// //       res.send({
// //         attendance,
// //         ...(distance != null && { distance }),
// //       });
// //     } catch (err) {
// //       res.status(400).send({ error: err.message });
// //     }
// //   }
// // ); old

// app.post(
//   "/api/checkin",
//   authenticate,
//   [
//     body("status").notEmpty(),
//     body("latitude").if(body("status").equals("present")).isFloat(),
//     body("longitude").if(body("status").equals("present")).isFloat(),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty())
//       return res.status(400).json({ errors: errors.array() });

//     try {
//       const { status, latitude, longitude } = req.body;
//       const employee = req.employee;

//       // Check if already checked in today
//       const todayStart = new Date();
//       todayStart.setHours(0, 0, 0, 0);
//       const todayEnd = new Date();
//       todayEnd.setHours(23, 59, 59, 999);

//       const existing = await Attendance.findOne({
//         employeeId: employee.employeeId,
//         date: { $gte: todayStart, $lte: todayEnd },
//       });

//       if (existing) {
//         return res
//           .status(400)
//           .send({ error: "You have already checked in today" });
//       }

//       let distance = null;

//       if (status === "present") {
//         if (latitude == null || longitude == null) {
//           return res
//             .status(400)
//             .send({ error: "Location required for office check-in" });
//         }

//         // Parse office locations from environment variable
//         const officeLocations = JSON.parse(
//           process.env.OFFICE_LOCATIONS || "[]"
//         );
//         if (!Array.isArray(officeLocations) || officeLocations.length === 0) {
//           return res.status(500).send({
//             error:
//               "Office locations are not configured properly. Please contact admin.",
//           });
//         }

//         let withinRange = false;
//         for (const office of officeLocations) {
//           const dist = calculateDistance(
//             latitude,
//             longitude,
//             parseFloat(office.lat),
//             parseFloat(office.lng)
//           );

//           if (dist <= 200) {
//             distance = dist;
//             withinRange = true;
//             break;
//           }
//         }

//         if (!withinRange) {
//           return res.status(400).send({
//             error: "You must be within 300 meters of the office to check in",
//           });
//         }
//       }

//       const attendance = new Attendance({
//         employeeId: employee.employeeId,
//         checkInTime: new Date(),
//         status,
//         ...(status === "present" && {
//           location: {
//             type: "Point",
//             coordinates: [longitude, latitude],
//           },
//           distance,
//         }),
//       });

//       await attendance.save();

//       employee.lastCheckIn = new Date();
//       await employee.save();

//       res.send({
//         attendance,
//         ...(distance != null && { distance }),
//       });
//     } catch (err) {
//       res.status(400).send({ error: err.message });
//     }
//   }
// );

// // Get Profile
// app.get("/api/me", authenticate, async (req, res) => {
//   res.send(req.employee);
// });

// app.post("/api/admin/login", async (req, res) => {
//   const { username, password } = req.body;

//   if (
//     username === process.env.ADMIN_USERNAME &&
//     password === process.env.ADMIN_PASSWORD
//   ) {
//     const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
//       expiresIn: "2h",
//     });
//     return res.send({ token });
//   } else {
//     return res.status(401).send({ error: "Invalid admin credentials" });
//   }
// });

// // Admin route - get all check-ins
// app.get("/api/admin/attendance", authenticate, async (req, res) => {
//   try {
//     const records = await Attendance.aggregate([
//       {
//         $lookup: {
//           from: "employees",
//           localField: "employeeId",
//           foreignField: "employeeId",
//           as: "employeeDetails",
//         },
//       },
//       {
//         $unwind: "$employeeDetails",
//       },
//       {
//         $project: {
//           employeeId: 1,
//           checkInTime: 1,
//           status: 1,
//           distance: 1,
//           employeeName: "$employeeDetails.name",
//         },
//       },
//       { $sort: { checkInTime: -1 } },
//       { $limit: 100 },
//     ]);

//     res.send(records);
//   } catch (err) {
//     res.status(400).send({ error: err.message });
//   }
// });

// // Get Attendance
// app.get("/api/attendance", authenticate, async (req, res) => {
//   try {
//     const records = await Attendance.find({
//       employeeId: req.employee.employeeId,
//     })
//       .sort({ date: -1 })
//       .limit(30);

//     res.send(records);
//   } catch (err) {
//     res.status(400).send({ error: err.message });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
