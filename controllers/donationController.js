// controllers/donationController.js
const DonationRequest = require('../models/DonationRequestModel');
const User = require('../models/UserModel');
const Donation = require('../models/DonationModel'); // ensure this model exists
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

/**
 * Create a public donation request (anyone can call)
 */
exports.createRequest = async (req, res, next) => {
  try {
    const { donorId, requesterName, requesterPhone, patientInfo } = req.body;

    if (!donorId || !requesterName || !patientInfo) {
      return next(new AppError('Required fields missing', 400));
    }

    const donor = await User.findById(donorId);
    if (!donor) {
      return next(new AppError('Donor not found', 404));
    }

    const dr = await DonationRequest.create({
      donor: donorId,
      requesterName,
      requesterPhone,
      patientInfo
    });

    res.status(201).json({
      status: 'success',
      data: { request: dr }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get requests assigned to logged in donor
 */
exports.getMyRequests = async (req, res, next) => {
  try {
    const requests = await DonationRequest.find({ donor: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({
      status: 'success',
      results: requests.length,
      data: { requests }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept a legacy DonationRequest (mark accepted, push to user's donationHistory, set disabledUntil)
 */
exports.acceptRequest = async (req, res, next) => {
  try {
    const reqId = req.params.id;
    const donationReq = await DonationRequest.findById(reqId);
    if (!donationReq) return next(new AppError('Request not found', 404));

    if (donationReq.donor.toString() !== req.user.id) {
      return next(new AppError('Not authorized to accept this request', 403));
    }

    if (donationReq.status !== 'pending') {
      return next(new AppError('Request is not pending', 400));
    }

    donationReq.status = 'accepted';
    donationReq.acceptedAt = new Date();
    await donationReq.save();

    // update user: push to donationHistory, set wantToDonate false, set disabledUntil 90 days
    const user = await User.findById(req.user.id);

    const acceptedEntry = {
      requestId: donationReq._id.toString(),
      patientInfo: donationReq.patientInfo,
      requesterName: donationReq.requesterName || '',
      requesterPhone: donationReq.requesterPhone || '',
      acceptedAt: donationReq.acceptedAt,
      createdAt: donationReq.createdAt
    };

    user.donationHistory = user.donationHistory || [];
    user.donationHistory.push(acceptedEntry);

    user.wantToDonate = false;
    const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
    user.disabledUntil = new Date(Date.now() + threeMonthsMs);

    await user.save({ validateBeforeSave: false });

    // Optionally create Donation doc (non-fatal)
    try {
      await Donation.create({
        requestId: donationReq._id,
        donorId: mongoose.Types.ObjectId(req.user.id),
        patientInfo: donationReq.patientInfo,
        requesterName: donationReq.requesterName || '',
        requesterPhone: donationReq.requesterPhone || '',
        status: 'accepted',
        acceptedAt: donationReq.acceptedAt
      });
    } catch (err) {
      console.warn('Warning: could not create Donation doc for acceptRequest:', err.message);
    }

    res.status(200).json({
      status: 'success',
      data: { request: donationReq, user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable donation for logged-in user (manual)
 */
exports.disableForDonating = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.wantToDonate = false;
    // optional custom disabledUntil via body.durationDays
    if (req.body.durationDays) {
      const ms = parseInt(req.body.durationDays, 10) * 24 * 60 * 60 * 1000;
      user.disabledUntil = new Date(Date.now() + ms);
    } else {
      user.disabledUntil = undefined; // no auto expiry if not provided
    }
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * Enable donation (manual)
 */
exports.enableForDonating = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.wantToDonate = true;
    user.disabledUntil = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * Utility: normalize a donation-like object to a consistent shape for the frontend
 */
function normalizeEntry(source, srcType = 'unknown') {
  // source may be Donation doc or embedded user history entry
  const acceptedAt = source.acceptedAt || source.createdAt || null;
  const createdAt = source.createdAt || acceptedAt || null;

  // make sure searchRequest/requestId/_id are strings if present
  const searchRequestId = source.searchRequest ? (source.searchRequest.toString ? source.searchRequest.toString() : source.searchRequest) : null;
  const requestId = source.requestId ? (source.requestId.toString ? source.requestId.toString() : source.requestId) : (searchRequestId || (source._id ? (source._id.toString ? source._id.toString() : source._id) : null));

  return {
    _id: source._id ? (source._id.toString ? source._id.toString() : source._id) : requestId || null,
    requestId: requestId || null,
    patientInfo: source.patientInfo || {},
    requesterName: source.requesterName || source.requesterName || '',
    requesterPhone: source.requesterPhone || source.requesterPhone || '',
    acceptedAt: acceptedAt ? new Date(acceptedAt) : null,
    scheduledAt: source.scheduledAt ? new Date(source.scheduledAt) : null,
    createdAt: createdAt ? new Date(createdAt) : null,
    status: source.status || 'accepted',
    _source: srcType
  };
}

/**
 * Get donation history for logged-in user — UNIFIED and DEDUPED
 * Combines: Donation documents (Donation collection) + embedded User.donationHistory,
 * then removes duplicates by a stable key.
 */
exports.getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1) fetch Donation docs for this donor (if Donation model exists)
    let donationDocs = [];
    try {
      donationDocs = await Donation.find({ donorId: userId }).sort({ acceptedAt: -1 }).lean();
    } catch (err) {
      // If Donation model/collection not present or error, continue with embedded only
      console.warn('Warning: could not load Donation docs:', err.message);
      donationDocs = [];
    }

    // 2) fetch embedded history from user
    const user = await User.findById(userId).lean();
    const embedded = (user && Array.isArray(user.donationHistory)) ? user.donationHistory : [];

    // 3) normalize both sources
    const normalizedFromDocs = donationDocs.map(d => normalizeEntry(d, 'DonationDoc'));
    const normalizedEmbedded = embedded.map(e => normalizeEntry(e, 'UserEmbedded'));

    // 4) combine then dedupe:
    // Build map keyed by: requestId (preferred) OR donation _id OR composite patientName + acceptedAt ISO
    const map = new Map();

    const makeKey = (entry) => {
      if (entry.requestId) return `req:${entry.requestId}`;
      if (entry._id) return `id:${entry._id}`;
      const name = (entry.patientInfo && (entry.patientInfo.patientName || entry.patientInfo.name)) || '';
      const time = entry.acceptedAt ? entry.acceptedAt.toISOString() : (entry.createdAt ? entry.createdAt.toISOString() : '');
      return `cmp:${name.trim().toLowerCase()}::${time}`;
    };

    // Insert docs first (prefer Donation docs if conflict)
    for (const e of normalizedFromDocs) {
      const key = makeKey(e);
      if (!map.has(key)) {
        map.set(key, e);
      } else {
        // prefer doc if existing is embedded; replace to prefer DonationDoc
        const existing = map.get(key);
        if (existing._source !== 'DonationDoc' && e._source === 'DonationDoc') {
          map.set(key, e);
        }
      }
    }

    // Insert embedded, only if not already present
    for (const e of normalizedEmbedded) {
      const key = makeKey(e);
      if (!map.has(key)) {
        map.set(key, e);
      }
    }

    // 5) create array and sort by acceptedAt/createdAt desc
    const combined = Array.from(map.values()).sort((a, b) => {
      const ta = (a.acceptedAt || a.createdAt || new Date(0)).getTime();
      const tb = (b.acceptedAt || b.createdAt || new Date(0)).getTime();
      return tb - ta;
    });

    res.status(200).json({
      status: 'success',
      results: combined.length,
      data: { history: combined }
    });
  } catch (error) {
    next(error);
  }
};
