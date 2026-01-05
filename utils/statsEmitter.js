// utils/statsEmitter.js
const User = require('../models/UserModel');
const Stats = require('../models/StatsModel');
const mongoose = require('mongoose');

let Donation = null;
try { Donation = mongoose.model('Donation'); } catch (e) {}

let ioInstance = null;

async function computeStats() {
  const donors = await User.countDocuments({ wantToDonate: true, isActive: true, isEmailVerified: true });
  let donations = 0;
  try {
    if (Donation) donations = await Donation.countDocuments({ status: 'completed' });
  } catch (e) { donations = 0; }
  const lives = donations;
  const districts = (await User.distinct('district')).filter(Boolean).length;
  const statsDoc = await Stats.findOne({ key: 'global' }).lean();
  const targets = (statsDoc && statsDoc.targets) ? statsDoc.targets : { donors: 300000, donations: 600000, lives: 1000000 };

  return { donors, donations, lives, districts, targets, updatedAt: new Date() };
}

function init(io) {
  ioInstance = io;
}

async function emitStats() {
  if (!ioInstance) return;
  try {
    const payload = await computeStats();
    ioInstance.emit('statsUpdate', { data: payload, targets: payload.targets, updatedAt: payload.updatedAt });
  } catch (err) {
    console.warn('emitStats error', err.message);
  }
}

module.exports = { init, emitStats, computeStats };
