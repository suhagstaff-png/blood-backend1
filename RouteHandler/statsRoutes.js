const express = require('express');
const statsController = require('../controllers/statsController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public: get aggregated stats
router.get('/', statsController.getStats);

// Protected: update stats (admin-only)
router.use(authController.protect);
router.patch('/', authController.restrictTo('admin'), statsController.updateStats);

module.exports = router;
