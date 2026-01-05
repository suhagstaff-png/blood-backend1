const BloodBank = require('../models/BloodBank');
const AppError = require('../utils/appError');

// Get all blood banks with filtering
exports.getAllBloodBanks = async (req, res, next) => {
  try {
    const { search, division, district } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { contactNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (division) {
      filter.division = division;
    }
    
    if (district) {
      filter.district = district;
    }
    
    filter.isActive = true;

    const bloodBanks = await BloodBank.find(filter).sort({ createdAt: -1 });
    
    res.status(200).json({
      status: 'success',
      results: bloodBanks.length,
      data: {
        bloodBanks
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single blood bank
exports.getBloodBank = async (req, res, next) => {
  try {
    const bloodBank = await BloodBank.findById(req.params.id);
    
    if (!bloodBank) {
      return next(new AppError('Blood bank not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        bloodBank
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create new blood bank
exports.createBloodBank = async (req, res, next) => {
  try {
    const { name, division, district, address, contactNumber } = req.body;

    // Basic validation
    if (!name || !division || !district || !address || !contactNumber) {
      return res.status(400).json({
        status: 'fail',
        message: 'All fields are required'
      });
    }

    const newBloodBank = await BloodBank.create({
      name,
      division,
      district,
      address,
      contactNumber
    });

    res.status(201).json({
      status: 'success',
      message: 'Blood bank created successfully',
      data: {
        bloodBank: newBloodBank
      }
    });
  } catch (error) {
    console.error('Error creating blood bank:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating blood bank'
    });
  }
};

// Update blood bank
exports.updateBloodBank = async (req, res, next) => {
  try {
    const { name, division, district, address, contactNumber, isActive } = req.body;
    
    const bloodBank = await BloodBank.findByIdAndUpdate(
      req.params.id,
      {
        name,
        division,
        district,
        address,
        contactNumber,
        isActive
      },
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!bloodBank) {
      return next(new AppError('Blood bank not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Blood bank updated successfully',
      data: {
        bloodBank
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete blood bank (soft delete)
exports.deleteBloodBank = async (req, res, next) => {
  try {
    const bloodBank = await BloodBank.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!bloodBank) {
      return next(new AppError('Blood bank not found', 404));
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Blood bank deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get blood bank statistics
exports.getBloodBankStats = async (req, res, next) => {
  try {
    const stats = await BloodBank.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: '$division',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const total = await BloodBank.countDocuments({ isActive: true });
    
    // Convert stats to object format
    const statsByDivision = {};
    stats.forEach(stat => {
      statsByDivision[stat._id] = stat.count;
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        total,
        byDivision: statsByDivision
      }
    });
  } catch (error) {
    next(error);
  }
};