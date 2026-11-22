import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  filename: { type: String, default: '' },
  format: { type: String, default: '' },
  width: Number,
  height: Number,
  bytes: Number,
  /** site-logo | home-hero | about-main | menu-product | gallery | other */
  assignment: {
    type: String,
    enum: ['site-logo', 'home-hero', 'about-main', 'menu-product', 'gallery', 'other', 'unassigned'],
    default: 'unassigned',
  },
  /** Optional link to menu item when assignment is menu-product */
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
  alt: { type: String, default: '' },
  tags: [{ type: String }],
}, { timestamps: true });

mediaSchema.index({ assignment: 1 });
mediaSchema.index({ filename: 'text', alt: 'text', tags: 'text' });

export default mongoose.model('Media', mediaSchema);
