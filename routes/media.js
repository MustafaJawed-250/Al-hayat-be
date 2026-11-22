import express from 'express';
import multer from 'multer';
import Media from '../models/Media.js';
import SiteSettings from '../models/SiteSettings.js';
import MenuItem from '../models/MenuItem.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadBuffer, destroyImage, isCloudinaryConfigured } from '../utils/cloudinary.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif|jpg)$/i.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP or GIF images allowed'));
    }
    cb(null, true);
  },
});

// Public: get site image assignments (hero, about, logo)
router.get('/settings', async (req, res) => {
  try {
    const keys = ['home-hero', 'about-main', 'site-logo'];
    const rows = await SiteSettings.find({ key: { $in: keys } }).lean();
    const map = {};
    rows.forEach((r) => {
      map[r.key] = r.value;
    });
    res.json({ success: true, data: map });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

// Admin: list media
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { assignment, search } = req.query;
    const filter = {};
    if (assignment) filter.assignment = assignment;
    if (search) filter.$text = { $search: search };
    const items = await Media.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      success: true,
      data: items,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list media' });
  }
});

// Admin: upload
router.post('/upload', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary is not configured. Add CLOUDINARY_* env vars.',
      });
    }
    const result = await uploadBuffer(req.file.buffer, {
      folder: 'al-hayat',
      public_id: undefined,
    });
    const assignment = req.body.assignment || 'unassigned';
    const media = await Media.create({
      url: result.secure_url,
      publicId: result.public_id,
      filename: req.file.originalname,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      assignment,
      alt: req.body.alt || '',
    });
    res.status(201).json({ success: true, data: media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// Admin: update assignment / alt
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { assignment, alt, tags, menuItemId } = req.body;
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Not found' });

    if (assignment !== undefined) media.assignment = assignment;
    if (alt !== undefined) media.alt = alt;
    if (tags !== undefined) media.tags = tags;
    if (menuItemId !== undefined) media.menuItemId = menuItemId || null;
    await media.save();

    // Apply assignment to site settings or menu item
    if (assignment === 'home-hero' || assignment === 'about-main' || assignment === 'site-logo') {
      await SiteSettings.findOneAndUpdate(
        { key: assignment },
        { key: assignment, value: { url: media.url, publicId: media.publicId, mediaId: media._id } },
        { upsert: true }
      );
    }
    if (assignment === 'menu-product' && menuItemId) {
      await MenuItem.findByIdAndUpdate(menuItemId, {
        image: media.url,
        imagePublicId: media.publicId,
      });
    }

    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Update failed' });
  }
});

// Admin: set site setting image by URL (no upload)
router.put('/settings/:key', requireAdmin, async (req, res) => {
  try {
    const key = req.params.key;
    if (!['home-hero', 'about-main', 'site-logo'].includes(key)) {
      return res.status(400).json({ success: false, message: 'Invalid settings key' });
    }
    const { url, publicId, mediaId } = req.body;
    if (!url) return res.status(400).json({ success: false, message: 'url required' });
    const row = await SiteSettings.findOneAndUpdate(
      { key },
      { key, value: { url, publicId: publicId || '', mediaId: mediaId || null } },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

// Admin: delete
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Not found' });
    await destroyImage(media.publicId);
    await media.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

export default router;
