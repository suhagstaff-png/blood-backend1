// models/donationModel.js
const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  searchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'SearchRequest' },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  patientInfo: {
    patientName: String,
    bloodGroup: String,
    bloodBagsNeeded: Number,
  },
  scheduledAt: Date,
  acceptedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['accepted','completed','cancelled'], default: 'accepted' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Donation', donationSchema);
