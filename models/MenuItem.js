import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, min: 0 },
}, { _id: true });

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  description: { type: String, default: '' },
  /** Selling / discounted price shown to customer */
  price: { type: Number, required: true, min: 0 },
  /** Original price (strikethrough). Optional. */
  originalPrice: { type: Number, min: 0, default: null },
  /** When true, UI shows "From Rs. X" */
  isFromPrice: { type: Boolean, default: false },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  image: { type: String, default: '' },
  imagePublicId: { type: String, default: '' },
  isAvailable: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  ingredients: [{ type: String }],
  spiceLevel: { type: Number, min: 0, max: 5, default: 0 },
  prepTime: { type: Number, default: 15 },
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  likes: { type: Number, default: 0 },
  chef: { type: String, default: 'AL HAYAT Kitchen' },
  kitchen: { type: String, default: 'AL HAYAT' },
  accent: { type: String, default: '#D4A017' },
  title: { type: String },
  subtitle: { type: String },
  variants: [variantSchema],
}, { timestamps: true });

menuItemSchema.index({ name: 'text', description: 'text' });
menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ slug: 1 });

export default mongoose.model('MenuItem', menuItemSchema);
