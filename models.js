const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  department: String,
  position: String,
  lastCheckIn: Date,
});

const attendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  date: { type: Date, default: Date.now },
  checkInTime: { type: Date, required: true },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  status: {
    type: String,
    enum: [
      "present",
      "late",
      "absent",
      "bootcamp",
      "workshop",
      "deployment",
      "on leave",
      "absent - sick",
      "absent - personal",
    ],
    default: "present",
  },
  distance: Number,
});

attendanceSchema.index({ location: "2dsphere" });

const Employee = mongoose.model("Employee", employeeSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = { Employee, Attendance };
