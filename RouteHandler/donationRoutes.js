const express = require('express');
const donationController = require('../controllers/donationController');
const authController = require('../controllers/authController');

const router = express.Router();

// public route to create a donation request (anyone can call)
router.post('/request', donationController.createRequest);

// protect next routes
router.use(authController.protect);

// donor's endpoints
router.get('/my-requests', donationController.getMyRequests);
router.put('/:id/accept', donationController.acceptRequest);

// enable/disable self
router.patch('/disable', donationController.disableForDonating);
router.patch('/enable', donationController.enableForDonating);

// get history (unified: user.donationHistory + Donation docs)
router.get('/history', donationController.getHistory);

module.exports = router;
