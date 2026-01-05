// models/StatsModel.js
const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    donors: { type: Number, default: 0 },
    donations: { type: Number, default: 0 },
    lives: { type: Number, default: 0 },
    districts: { type: Number, default: 0 },
    // optional targets (you can adjust from admin)
    targets: {
      donors: { type: Number, default: 300000 },
      donations: { type: Number, default: 600000 },
      lives: { type: Number, default: 1000000 }
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Stats', statsSchema);
