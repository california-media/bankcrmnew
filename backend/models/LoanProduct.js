const mongoose = require('mongoose');

const bracketSchema = new mongoose.Schema(
  {
    minimumSalary: { type: Number, required: true, min: 0 },
    receivable: { type: Number, required: true, min: 0 },
    payable: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const loanProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    loanCategory: { type: String, enum: ['personal', 'mortgage'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    commissionBrackets: { type: [bracketSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoanProduct', loanProductSchema);
