import express from 'express';
import Message from '../models/Message.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }
    const msg = await Message.create({ name, email, phone, subject, message });
    res.status(201).json({ success: true, data: { id: msg._id }, message: 'Message sent successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

router.put('/:id/read', requireAdmin, async (req, res) => {
  try {
    const msg = await Message.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!msg) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

export default router;
