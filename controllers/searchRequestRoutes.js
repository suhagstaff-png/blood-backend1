// routes/searchRequestRoutes.js
const express = require("express");
const SearchRequest = require("../models/SearchRequestModel");
const User = require("../models/UserModel");
const Donation = require("../models/DonationModel"); // new model
const mongoose = require('mongoose');
const router = express.Router();

// Create new search request
router.post("/", async (req, res) => {
  try {
    const {
      browserId,
      patientInfo,
      filters,
      foundDonors,
      selectedDonors,
      status,
      searchDate,
    } = req.body;

    const searchRequest = new SearchRequest({
      browserId,
      patientInfo,
      filters,
      foundDonors,
      selectedDonors,
      status: status || "active",
      searchDate: searchDate || new Date(),
    });

    await searchRequest.save();

    res.status(201).json({
      status: "success",
      data: { searchRequest },
    });
  } catch (error) {
    console.error("Error creating search request:", error);
    res.status(500).json({ status: "error", message: "Error creating search request" });
  }
});

// Get latest search request (global latest)
router.get("/latest", async (req, res) => {
  try {
    const searchRequest = await SearchRequest.findOne()
      .sort({ searchDate: -1 })
      .populate("foundDonors selectedDonors");

    if (!searchRequest) {
      return res.status(404).json({ status: "error", message: "No search request found" });
    }

    res.status(200).json({ status: "success", data: { searchRequest } });
  } catch (error) {
    console.error("Error fetching latest search request:", error);
    res.status(500).json({ status: "error", message: "Error fetching search request" });
  }
});

// Get latest search request for a specific browserId
router.get("/browser/:browserId/latest", async (req, res) => {
  try {
    const { browserId } = req.params;

    const searchRequest = await SearchRequest.findOne({ browserId })
      .sort({ searchDate: -1 })
      .populate("foundDonors selectedDonors");

    if (!searchRequest) {
      return res.status(404).json({ status: "error", message: "No search request found for this browser" });
    }

    res.status(200).json({ status: "success", data: { searchRequest } });
  } catch (error) {
    console.error("Error fetching browser search request:", error);
    res.status(500).json({ status: "error", message: "Error fetching search request" });
  }
});

// ------------------ NEW: donor-specific endpoints ------------------

// Get latest search-request where donor is in selectedDonors
router.get("/donor/:donorId/latest", async (req, res) => {
  const { donorId } = req.params;
  try {
    const donorObjectId = mongoose.Types.ObjectId.isValid(donorId)
      ? mongoose.Types.ObjectId(donorId)
      : donorId;

    const searchRequest = await SearchRequest.findOne({
      selectedDonors: donorObjectId,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!searchRequest) {
      return res.status(404).json({ success: false, message: "No search request" });
    }

    return res.json({
      success: true,
      data: { searchRequest },
    });
  } catch (err) {
    console.error("Error fetching latest search for donor:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all search-requests where donor is in selectedDonors
router.get("/donor/:donorId", async (req, res) => {
  const { donorId } = req.params;
  try {
    // Ensure ObjectId format
    const donorObjectId = mongoose.Types.ObjectId.isValid(donorId)
      ? mongoose.Types.ObjectId(donorId)
      : donorId;

    const searchRequests = await SearchRequest.find({
      selectedDonors: donorObjectId,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json({
      success: true,
      data: { searchRequests },
    });
  } catch (err) {
    console.error("Error listing selected search requests:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// Donor accepts a search-request => create donation, update user (disable), return donation + updated searchRequest

// --- replace the accept handler in routes/searchRequestRoutes.js ---
router.put("/donor/:donorId/:searchRequestId/accept", async (req, res) => {
  const { donorId, searchRequestId } = req.params;
  const { scheduledAt } = req.body;

  try {
    // find search request
    const searchRequest = await SearchRequest.findById(searchRequestId);
    if (!searchRequest) {
      return res.status(404).json({ success: false, message: "SearchRequest not found" });
    }

    // ensure donor is still selected
    const isSelected = (searchRequest.selectedDonors || []).some(
      (d) => d.toString() === donorId.toString()
    );
    if (!isSelected) {
      return res.status(400).json({ success: false, message: "You are not selected for this request" });
    }

    // scheduled date (fallback now)
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date();

    // create donation record
    const donation = new Donation({
      searchRequest: searchRequest._id,
      donorId: mongoose.Types.ObjectId(donorId),
      patientInfo: searchRequest.patientInfo || {},
      requesterName: searchRequest.requesterName || "",
      requesterPhone: searchRequest.requesterPhone || "",
      status: "accepted",
      acceptedAt: new Date(),
      scheduledAt: scheduledDate,
      createdAt: new Date(),
    });
    await donation.save();

    // update searchRequest: remove donor from selectedDonors, set acceptedDonor & status
    searchRequest.selectedDonors = (searchRequest.selectedDonors || []).filter(
      (d) => d.toString() !== donorId.toString()
    );
    searchRequest.acceptedDonor = donorId;
    searchRequest.status = "matched";
    searchRequest.matchedAt = new Date();
    await searchRequest.save();

    // compute disabledUntil = scheduledAt + 3 months
    const disableFrom = scheduledDate;
    const disableUntil = new Date(disableFrom);
    disableUntil.setMonth(disableUntil.getMonth() + 3);

    // --- IMPORTANT FIX ---
    // Previously you were using donation._id as requestId for user's embedded history.
    // That causes mismatch because Donation doc's normalization uses searchRequest as requestId.
    // To dedupe correctly, set the embedded entry's requestId to the same searchRequest id
    // that the Donation doc references (i.e. searchRequest._id).
    const donationEntryForUser = {
      // use the searchRequest id as requestId so Donation doc + embedded entry share the same key
      requestId: searchRequest._id ? searchRequest._id.toString() : (donation._id ? donation._id.toString() : null),
      patientInfo: donation.patientInfo || {},
      requesterName: donation.requesterName || '',
      requesterPhone: donation.requesterPhone || '',
      acceptedAt: donation.acceptedAt,
      scheduledAt: donation.scheduledAt,
      createdAt: donation.createdAt
    };

    const updatedDonor = await User.findByIdAndUpdate(
      donorId,
      {
        $set: {
          wantToDonate: false,
          disabledUntil: disableUntil
        },
        $push: {
          donationHistory: donationEntryForUser
        }
      },
      { new: true, runValidators: false }
    );

    const populatedSearchRequest = await SearchRequest.findById(searchRequest._id).populate("foundDonors selectedDonors");

    return res.status(200).json({
      success: true,
      data: { donation, searchRequest: populatedSearchRequest, donor: updatedDonor },
      message: "Accepted and donation created"
    });
  } catch (err) {
    console.error("Accept search-request error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error accepting request",
      error: err.message,
    });
  }
});


/**
 * Donor declines / cancels their selection for a specific searchRequest.
 * Removes donorId from selectedDonors array (does NOT delete the request).
 */
router.delete("/donor/:donorId/:searchRequestId/decline", async (req, res) => {
  try {
    const { donorId, searchRequestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(donorId) || !mongoose.Types.ObjectId.isValid(searchRequestId)) {
      return res.status(400).json({ status: "error", message: "Invalid ID(s) provided" });
    }

    const searchRequest = await SearchRequest.findById(searchRequestId);
    if (!searchRequest) {
      return res.status(404).json({ status: "error", message: "Search request not found" });
    }

    const beforeCount = (searchRequest.selectedDonors || []).length;
    searchRequest.selectedDonors = (searchRequest.selectedDonors || []).filter(d => d.toString() !== donorId.toString());

    // optionally update status if no selected donors left
    if ((searchRequest.selectedDonors || []).length === 0 && searchRequest.foundDonors && searchRequest.foundDonors.length === 0) {
      searchRequest.status = "active"; // or "open"
    }

    searchRequest.updatedAt = new Date();
    await searchRequest.save();

    const populated = await SearchRequest.findById(searchRequest._id).populate("foundDonors selectedDonors");

    return res.status(200).json({
      status: "success",
      message: "You have been removed from selected donors",
      data: {
        searchRequest: populated,
        removedCount: beforeCount - (populated.selectedDonors || []).length,
      },
    });
  } catch (err) {
    console.error("Decline search-request error:", err);
    return res.status(500).json({ status: "error", message: "Server error declining request", error: err.message });
  }
});

// Donor rejects a search-request => remove donor from selectedDonors
router.put("/donor/:donorId/:searchRequestId/reject", async (req, res) => {
  const { donorId, searchRequestId } = req.params;
  try {
    const searchRequest = await SearchRequest.findById(searchRequestId);
    if (!searchRequest) {
      return res.status(404).json({ success: false, message: "SearchRequest not found" });
    }

    searchRequest.selectedDonors = (searchRequest.selectedDonors || []).filter(
      (d) => d.toString() !== donorId.toString()
    );
    await searchRequest.save();

    return res.json({
      success: true,
      data: { searchRequest },
      message: "Removed from selected donors",
    });
  } catch (err) {
    console.error("Reject search-request error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
// ------------------ existing update + reset + list endpoints ------------------

// Update latest search request for browserId (selected donors, status, edits)
router.put("/browser/:browserId/latest", async (req, res) => {
  try {
    const { browserId } = req.params;
    const { selectedDonors, status, cancelledAt, patientInfo, filters, foundDonors } = req.body;

    let searchRequest = await SearchRequest.findOne({ browserId }).sort({ searchDate: -1 });

    if (!searchRequest) {
      // If not found, create one (helps when client sends update before create)
      searchRequest = new SearchRequest({
        browserId,
        patientInfo: patientInfo || {},
        filters: filters || {},
        foundDonors: foundDonors || [],
        selectedDonors: selectedDonors || [],
        status: status || "active",
        searchDate: new Date(),
      });
    } else {
      if (selectedDonors !== undefined) searchRequest.selectedDonors = selectedDonors;
      if (patientInfo) searchRequest.patientInfo = patientInfo;
      if (filters) searchRequest.filters = filters;
      if (foundDonors) searchRequest.foundDonors = foundDonors;
      if (status) searchRequest.status = status;
      if (cancelledAt) searchRequest.cancelledAt = cancelledAt;
      searchRequest.updatedAt = new Date();
    }

    await searchRequest.save();

    const populated = await SearchRequest.findById(searchRequest._id).populate("foundDonors selectedDonors");

    res.status(200).json({
      status: "success",
      data: {
        searchRequest: populated,
      },
    });
  } catch (error) {
    console.error("Error updating search request:", error);
    res.status(500).json({
      status: "error",
      message: "Error updating search request",
    });
  }
});

// Reset search request for this browser (clear patient & filters & found/selected donors)
router.delete("/browser/:browserId/reset", async (req, res) => {
  try {
    const { browserId } = req.params;

    const searchRequest = await SearchRequest.findOne({ browserId }).sort({ searchDate: -1 });

    if (!searchRequest) {
      return res.status(200).json({ status: "success", message: "No existing search request to reset" });
    }

    searchRequest.patientInfo = { patientName: "", bloodGroup: "", bloodBagsNeeded: 1 };
    searchRequest.filters = { bloodGroup: "", division: "", district: "", upazila: "", area: "" };
    searchRequest.foundDonors = [];
    searchRequest.selectedDonors = [];
    searchRequest.status = "reset";
    searchRequest.updatedAt = new Date();

    await searchRequest.save();

    res.status(200).json({ status: "success", message: "Search request reset successfully", data: { searchRequest } });
  } catch (error) {
    console.error("Error resetting search request:", error);
    res.status(500).json({ status: "error", message: "Error resetting search request" });
  }
});

// Get all search requests (for admin)
router.get("/", async (req, res) => {
  try {
    const searchRequests = await SearchRequest.find().populate("foundDonors selectedDonors").sort({ searchDate: -1 });

    res.status(200).json({ status: "success", results: searchRequests.length, data: { searchRequests } });
  } catch (error) {
    console.error("Error fetching search requests:", error);
    res.status(500).json({ status: "error", message: "Error fetching search requests" });
  }
});

module.exports = router;
