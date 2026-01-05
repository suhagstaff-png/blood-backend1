// models/ReviewModel.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  division: {
    type: String,
    required: [true, 'Division required'],
    enum: ['dhaka','chattogram','rajshahi','khulna','barishal','sylhet','rangpur','mymensingh']
  },
  name: { type: String, required: [true, 'Name required'] },
  email: {
    type: String,
    required: [true, 'Email required'],
    lowercase: true,
    trim: true
  },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  comment: { type: String, required: [true, 'Comment required'] },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // optional
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);
