// controllers/statsController.js
const mongoose = require('mongoose');
const Stats = require('../models/StatsModel');
const User = require('../models/UserModel');

let Donation = null;
let DonationRequest = null;
let SearchRequest = null;

try { Donation = require('../models/DonationModel'); } catch (e) { try { Donation = mongoose.model('Donation'); } catch(e2) { Donation = null; } }
try { DonationRequest = require('../models/DonationRequestModel'); } catch (e) { try { DonationRequest = mongoose.model('DonationRequest'); } catch(e2) { DonationRequest = null; } }
try { SearchRequest = require('../models/SearchRequestModel'); } catch (e) { try { SearchRequest = mongoose.model('SearchRequest'); } catch(e2) { SearchRequest = null; } }

/**
 * compute donations using multiple fallbacks:
 * 1) Donation model documents with status accepted/completed
 * 2) Donation documents with acceptedAt
 * 3) Donation documents with donorId present
 * 4) DonationRequest with status 'accepted'
 * 5) Sum selectedDonors from SearchRequest completed entries (if present)
 */
async function computeDonationsCount() {
  if (Donation) {
    try {
      // 1) status accepted or completed (your schema default is 'accepted')
      const byStatus = await Donation.countDocuments({ status: { $in: ['completed', 'accepted'] } });
      if (byStatus > 0) return { count: byStatus, method: 'donation.status(accepted|completed)' };
    } catch (e) { /* continue */ }

    try {
      // 2) acceptedAt exists
      const byAcceptedAt = await Donation.countDocuments({ acceptedAt: { $exists: true, $ne: null } });
      if (byAcceptedAt > 0) return { count: byAcceptedAt, method: 'donation.acceptedAt' };
    } catch (e) { /* continue */ }

    try {
      // 3) donorId exists (any donation-like doc)
      const byDonor = await Donation.countDocuments({ donorId: { $exists: true, $ne: null } });
      if (byDonor > 0) return { count: byDonor, method: 'donation.donorId' };
    } catch (e) { /* continue */ }
  }

  // 4) DonationRequest accepted
  if (DonationRequest) {
    try {
      const drCount = await DonationRequest.countDocuments({ status: 'accepted' });
      if (drCount > 0) return { count: drCount, method: 'donationRequest.accepted' };
    } catch (e) { /* continue */ }
  }

  // 5) Sum selectedDonors from SearchRequest (completed requests)
  if (SearchRequest) {
    try {
      const completed = await SearchRequest.find({ status: 'completed' }).select('selectedDonors').lean();
      const sumSelected = completed.reduce((acc, r) => acc + (Array.isArray(r.selectedDonors) ? r.selectedDonors.length : 0), 0);
      if (sumSelected > 0) return { count: sumSelected, method: 'searchRequest.selectedDonorsSum' };
    } catch (e) { /* continue */ }
  }

  return { count: 0, method: 'no-match' };
}

/**
 * GET /api/stats
 */
exports.getStats = async (req, res) => {
  try {
    // total registered users (all)
    const totalUsers = await User.countDocuments();

    // number of users who want to donate (নিবন্ধিত রক্তদাতা in sense of donors)
    const donorsCount = await User.countDocuments();

    // distinct districts & divisions
    const districtsDistinct = await User.distinct('district');
    const districtsCount = districtsDistinct ? districtsDistinct.length : 0;
    const divisionsDistinct = await User.distinct('division');
    const divisionsCount = divisionsDistinct ? divisionsDistinct.length : 0;

    // compute donations using fallbacks
    const donationsResult = await computeDonationsCount();
    let donationsCount = donationsResult.count;
    let donationsMethod = donationsResult.method;

    // If donations still zero, attempt one more fallback:
    // count DonationRequest accepted + Donation status 'accepted' aggregated (avoid double count if both exist)
    if (donationsCount === 0 && DonationRequest) {
      try {
        const drAccepted = await DonationRequest.countDocuments({ status: 'accepted' });
        if (drAccepted > 0) {
          donationsCount = drAccepted;
          donationsMethod = 'donationRequest.accepted (fallback)';
        }
      } catch (e) { /* ignore */ }
    }

    // successful requests (খুঁজে পাওয়া সফল অনুরোধ):
    // prefer DonationRequest accepted, else SearchRequest completed+selectedDonors
    let successfulRequests = 0;
    let successfulMethod = null;
    if (DonationRequest) {
      try {
        successfulRequests = await DonationRequest.countDocuments({ status: 'accepted' });
        successfulMethod = 'donationRequest.accepted';
      } catch (e) { successfulRequests = 0; }
    }
    if (!successfulRequests && SearchRequest) {
      try {true
        successfulRequests = await SearchRequest.countDocuments({ status: 'completed', selectedDonors: { $exists: true, $ne: [] } });
        successfulMethod = 'searchRequest.completed-with-selectedDonors';
      } catch (e) { successfulRequests = 0; }
    }

    // lives: prefer donationsCount (each donation -> life), else successfulRequests, else Stats stored
    let livesCount = donationsCount || successfulRequests || 0;

    // load Stats doc for targets & fallback stored numbers
    let statsDoc = await Stats.findOne({ key: 'global' }).lean();
    if (!statsDoc) {
      statsDoc = await Stats.create({
        key: 'global',
        donors: donorsCount,
        donations: donationsCount || 0,
        lives: livesCount || 0,
        districts: districtsCount,
        targets: { donors: 300000, donations: 600000, lives: 1000000 }
      });
    } else {
      if (!donationsCount) donationsCount = statsDoc.donations || 0;
      if (!livesCount) livesCount = statsDoc.lives || donationsCount || 0;
    }

    // assemble payload
    const payload = {
      totalUsers,               // total registered users
      donors: donorsCount,      // users with wantToDonate: true
      donations: donationsCount,
      lives: livesCount,
      districts: districtsCount,
      divisions: divisionsCount,
      searches: SearchRequest ? await SearchRequest.countDocuments().catch(()=>0) : 0,
      successfulRequests,
      targets: statsDoc.targets || { donors: 300000, donations: 600000, lives: 1000000 },
      updatedAt: statsDoc.updatedAt || new Date()
    };

    // persist computed non-destructively
    await Stats.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          donors: payload.donors,
          donations: payload.donations,
          lives: payload.lives,
          districts: payload.districts,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // debug info for development
    const debug = (process.env.NODE_ENV !== 'production') ? {
      modelsLoaded: {
        Donation: !!Donation,
        DonationRequest: !!DonationRequest,
        SearchRequest: !!SearchRequest
      },
      donationsMethod,
      donationsCountComputed: donationsCount,
      successfulMethod
    } : undefined;

    return res.status(200).json({ status: 'success', data: payload, debug });
  } catch (err) {
    console.error('Error in getStats:', err);
    return res.status(500).json({ status: 'error', message: 'Error fetching stats', error: err.message });
  }
};

/**
 * PATCH /api/stats (admin)
 */
exports.updateStats = async (req, res) => {
  try {
    const allowed = {};
    ['donors', 'donations', 'lives', 'districts', 'targets'].forEach(k => {
      if (req.body[k] !== undefined) allowed[k] = req.body[k];
    });

    const updated = await Stats.findOneAndUpdate(
      { key: 'global' },
      { $set: { ...allowed, updatedAt: new Date() } },
      { new: true, upsert: true }
    );

    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    console.error('Error in updateStats:', err);
    res.status(500).json({ status: 'error', message: 'Error updating stats' });
  }
};
