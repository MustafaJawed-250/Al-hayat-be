import express from 'express';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public: list all available items (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { category, featured, search, available } = req.query;
    const filter = {};
    if (available !== 'false') filter.isAvailable = true;
    if (featured === 'true') filter.isFeatured = true;
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };

    const items = await MenuItem.find(filter)
      .populate('category', 'name slug')
      .sort({ isFeatured: -1, createdAt: -1 })
      .lean();

    res.json({ success: true, data: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch menu' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 }).lean();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate('category').lean();
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch item' });
  }
});

// Admin: create
router.post('/', requireAdmin, async (req, res) => {
  try {
    const data = req.body;
    if (!data.name || data.price == null || !data.category) {
      return res.status(400).json({ success: false, message: 'Name, price and category are required' });
    }
    data.slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const item = await MenuItem.create(data);
    const populated = await MenuItem.findById(item._id).populate('category').lean();
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create item' });
  }
});

// Admin: update
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('category');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update' });
  }
});

// Admin: delete
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
});

export default router;
