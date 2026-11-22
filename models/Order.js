import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: String,
  price: Number,
  quantity: { type: Number, min: 1 },
  image: String,
  variantName: String,
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  customer: {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    notes: { type: String },
  },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 250 },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['New', 'Confirmed'],
    default: 'New',
  },
  paymentMethod: { type: String, default: 'COD' },
  confirmedAt: { type: Date, default: null },
  adminNotifiedAt: { type: Date, default: null },
  customerNotifiedAt: { type: Date, default: null },
}, { timestamps: true });

orderSchema.index({ orderId: 1 });
orderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
