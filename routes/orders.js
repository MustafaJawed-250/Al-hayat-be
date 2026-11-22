import express from 'express';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendAdminNewOrderEmail, sendCustomerConfirmationEmail } from '../services/email.js';

const router = express.Router();

function generateOrderId() {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AH-${now}-${rand}`;
}

// Public: place order (COD)
router.post('/', async (req, res) => {
  try {
    const { customer, items } = req.body;
    if (!customer?.fullName || !customer?.phone || !customer?.email || !customer?.city || !customer?.address) {
      return res.status(400).json({ success: false, message: 'Customer details incomplete (name, phone, email, city, address required)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    let subtotal = 0;
    const orderItems = [];
    for (const line of items) {
      const dbItem = await MenuItem.findById(line.menuItem || line._id).lean();
      if (!dbItem || !dbItem.isAvailable) {
        return res.status(400).json({ success: false, message: `Item unavailable: ${line.name || 'unknown'}` });
      }
      const qty = Math.max(1, Math.min(99, Number(line.quantity) || 1));
      let price = dbItem.price;
      let variantName = '';
      if (line.variantId && Array.isArray(dbItem.variants)) {
        const v = dbItem.variants.find((x) => String(x._id) === String(line.variantId));
        if (v) {
          price = v.price;
          variantName = v.name;
        }
      }
      subtotal += price * qty;
      orderItems.push({
        menuItem: dbItem._id,
        name: dbItem.name,
        price,
        quantity: qty,
        image: dbItem.image,
        variantName,
      });
    }

    const deliveryCharge = Number(process.env.DELIVERY_CHARGE) || 250;
    const total = subtotal + deliveryCharge;
    const orderId = generateOrderId();

    const order = await Order.create({
      orderId,
      customer,
      items: orderItems,
      subtotal,
      deliveryCharge,
      total,
      status: 'New',
      paymentMethod: 'COD',
    });

    // Notify admin — do not fail the order if email fails
    const notify = await sendAdminNewOrderEmail(order.toObject());
    if (notify.success) {
      order.adminNotifiedAt = new Date();
      await order.save();
    } else if (notify.error) {
      console.error('Admin email error (order kept):', notify.error);
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: order.orderId,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  }
});

// Admin: list orders
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { orderId: new RegExp(search, 'i') },
        { 'customer.fullName': new RegExp(search, 'i') },
        { 'customer.phone': new RegExp(search, 'i') },
        { 'customer.email': new RegExp(search, 'i') },
      ];
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list orders' });
  }
});

// Admin: get one
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({
      $or: [{ _id: req.params.id }, { orderId: req.params.id }],
    }).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load order' });
  }
});

/**
 * Confirm order:
 * 1) Send customer confirmation email
 * 2) Only if email succeeds (or is skipped due to missing config), set status Confirmed
 * 3) Prevent double-confirm
 */
router.put('/:id/confirm', requireAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({
      $or: [{ _id: req.params.id }, { orderId: req.params.id }],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'Confirmed') {
      return res.status(400).json({ success: false, message: 'Order is already confirmed' });
    }

    const emailResult = await sendCustomerConfirmationEmail(order.toObject());
    if (emailResult.error && !emailResult.skipped) {
      return res.status(502).json({
        success: false,
        message: `Confirmation email failed: ${emailResult.error}. Order remains New — try again.`,
      });
    }

    order.status = 'Confirmed';
    order.confirmedAt = new Date();
    if (emailResult.success) order.customerNotifiedAt = new Date();
    await order.save();

    res.json({
      success: true,
      data: order,
      email: emailResult.skipped ? 'skipped' : 'sent',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to confirm order' });
  }
});

// Status endpoint — only New | Confirmed. Prefer PUT /:id/confirm for confirmation + email.
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (status === 'Confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Use the Confirm Order action (PUT /orders/:id/confirm) so the customer receives their email.',
      });
    }
    if (status !== 'New') {
      return res.status(400).json({
        success: false,
        message: 'Only statuses New and Confirmed are allowed.',
      });
    }
    const order = await Order.findOneAndUpdate(
      { $or: [{ _id: req.params.id }, { orderId: req.params.id }] },
      { status: 'New', confirmedAt: null },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Status update failed' });
  }
});

export default router;
