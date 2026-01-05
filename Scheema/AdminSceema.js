const mongoose = require("mongoose");
let uniqueValidator = require("mongoose-unique-validator");
const AdminSchema = mongoose.Schema({
  email: {
    type: "string",
    require: "true",
  },

  password: {
    type: "string",
    require: "true",
  },
});
AdminSchema.plugin(uniqueValidator);
module.exports = AdminSchema;
