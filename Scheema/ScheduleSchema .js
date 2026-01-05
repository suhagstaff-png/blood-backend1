const mongoose = require("mongoose");

const ScheduleSchema  = mongoose.Schema({
    date: { type: String, required: true },
    time: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    description: { type: String },
    meetingPlatform: { type: String, required: true },
    convertedTime: { type: String },
    bangladeshTime: {type: String}, 
});

// Export the schema
module.exports = ScheduleSchema ;
