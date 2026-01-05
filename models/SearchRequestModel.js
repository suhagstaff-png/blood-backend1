// models/SearchRequestModel.js
const mongoose = require("mongoose");

const SearchRequestSchema = new mongoose.Schema(
  {
    browserId: {
      type: String,
      index: true,
      required: false, // it may be missing if created by other flows
    },
    patientInfo: {
      patientName: { type: String, default: "" },
      bloodGroup: { type: String, default: "" },
      bloodBagsNeeded: { type: Number, default: 1 },
    },
    filters: {
      bloodGroup: { type: String, default: "" },
      division: { type: String, default: "" },
      district: { type: String, default: "" },
      upazila: { type: String, default: "" },
      area: { type: String, default: "" },
    },
    foundDonors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    selectedDonors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, default: "active" }, // active, completed, cancelled, reset
    searchDate: { type: Date, default: Date.now },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SearchRequest", SearchRequestSchema);
