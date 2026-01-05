const mongoose = require('mongoose');

const bloodBankSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Blood bank name is required'],
    trim: true
  },
  division: {
    type: String,
    required: [true, 'Division is required'],
    enum: ['dhaka', 'chattogram', 'rajshahi', 'khulna', 'barishal', 'sylhet', 'rangpur', 'mymensingh']
  },
  district: {
    type: String,
    required: [true, 'District is required']
  },
  address: {
    type: String,
    required: [true, 'Address is required']
  },
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required']
  },
  established: {
    type: String,
    default: new Date().getFullYear().toString()
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better search performance
bloodBankSchema.index({ division: 1, district: 1 });
bloodBankSchema.index({ name: 'text', address: 'text' });

const BloodBank = mongoose.model('BloodBank', bloodBankSchema);

module.exports = BloodBank;