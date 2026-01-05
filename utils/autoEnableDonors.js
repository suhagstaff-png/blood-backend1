// utils/autoEnableDonors.js
const User = require('../models/UserModel');
const mongoose = require('mongoose');
const statsEmitter = require('./statsEmitter'); // optional

// Using node-cron (install: npm i node-cron)
const cron = require('node-cron');

async function runEnableJob() {
  try {
    const now = new Date();
    const res = await User.updateMany(
      { disabledUntil: { $lte: now }, wantToDonate: false },
      { $set: { wantToDonate: true }, $unset: { disabledUntil: "" } }
    );
    if (res && res.modifiedCount > 0) {
      console.log(`Auto-enabled ${res.modifiedCount} donors`);
      try {
        if (statsEmitter && typeof statsEmitter.emitStats === 'function') {
          await statsEmitter.emitStats();
        }
      } catch (e) {
        console.warn('emitStats after auto-enable failed:', e.message);
      }
    }
  } catch (err) {
    console.error('auto-enable job error:', err);
  }
}

function initAutoEnableSchedule() {
  // run daily at 02:10 server time
  cron.schedule('10 2 * * *', () => {
    console.log('Running auto-enable donors job...');
    runEnableJob();
  });

  // optionally run once at startup
  runEnableJob().catch((e) => console.warn('startup runEnableJob failed', e.message));
}

module.exports = { initAutoEnableSchedule, runEnableJob };
