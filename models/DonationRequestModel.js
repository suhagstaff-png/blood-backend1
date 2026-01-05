// models/DonationRequestModel.js
const mongoose = require('mongoose');

const DonationRequestSchema = new mongoose.Schema({
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // assigned donor
  requesterName: { type: String, required: true },
  requesterPhone: { type: String },
  patientInfo: {
    patientName: { type: String },
    bloodGroup: { type: String },
    bloodBagsNeeded: { type: Number, default: 1 }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'cancelled'],
    default: 'pending'
  },
  acceptedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DonationRequest', DonationRequestSchema);
