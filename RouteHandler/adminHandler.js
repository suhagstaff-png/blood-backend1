const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AdminSchema = require("../Scheema/AdminSceema");
const Admin = mongoose.model("singupadmin", AdminSchema); // Corrected model name
const saltRounds = 10;
const axios = require("axios");
const nodemailer = require("nodemailer");
const ScheduleScheema = require("../Scheema/ScheduleSchema ");
const Schedule = mongoose.model("schedule", ScheduleScheema); 
// Separate function to handle email sending

// POST route for logging in
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    // Check if user exists in the database
    const user = await Admin.findOne({ email }); // Ensure 'email' matches correctly
    if (!user) {
      return res.status(401).json({ error: "Wrong username or password." });
    }

    // Validate password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Wrong username or password." });
    }

    // Generate token if email and password are valid
    const token = jwt.sign(
      {
        username: user.username,
        userId: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      access_token: token,
      message: "Login successful!",
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "Server error, please try again." });
  }
});



module.exports = router;
