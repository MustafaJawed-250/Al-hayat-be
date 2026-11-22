import express from 'express';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import Message from '../models/Message.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAdmin);

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      newOrders,
      todayOrders,
      revenueAgg,
      totalProducts,
      totalCategories,
      unreadMessages,
      popular,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'New' }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      Order.aggregate([
        { $match: { status: { $in: ['Confirmed'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      MenuItem.countDocuments(),
      Category.countDocuments(),
      Message.countDocuments({ isRead: false }),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.name', count: { $sum: '$items.quantity' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        newOrders,
        todayOrders,
        totalRevenue: revenueAgg[0]?.total || 0,
        totalProducts,
        totalCategories,
        unreadMessages,
        popularDishes: popular,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

// Categories CRUD
router.get('/categories', async (req, res) => {
  try {
    const cats = await Category.find().sort({ order: 1 }).lean();
    res.json({ success: true, data: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, order, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const cat = await Category.create({ name, slug, order: order || 0, description });
    res.status(201).json({ success: true, data: cat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: cat });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const count = await MenuItem.countDocuments({ category: req.params.id });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${count} product(s) still use this category. Reassign them first.`,
      });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

export default router;
