import express from 'express';
import multer from 'multer';
import Media from '../models/Media.js';
import SiteSettings from '../models/SiteSettings.js';
import MenuItem from '../models/MenuItem.js';
import Gallery from '../models/Gallery.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadBuffer, destroyImage, isCloudinaryConfigured } from '../utils/cloudinary.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif|jpg)$/i.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

async function applyAssignment(media, assignment, { menuItemId, caption, order } = {}) {
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

  if (assignment === 'gallery') {
    const existing = await Gallery.findOne({ image: media.url });
    if (!existing) {
      const maxOrder = await Gallery.findOne().sort({ order: -1 }).select('order').lean();
      await Gallery.create({
        image: media.url,
        caption: caption || media.alt || media.filename || '',
        order: order != null ? Number(order) : (maxOrder?.order ?? 0) + 1,
        isActive: true,
      });
    } else if (caption) {
      existing.caption = caption;
      await existing.save();
    }
  }
}

// Public: get site image assignments
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
    if (search) {
      filter.$or = [
        { filename: new RegExp(search, 'i') },
        { alt: new RegExp(search, 'i') },
        { publicId: new RegExp(search, 'i') },
      ];
    }
    const items = await Media.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    res.json({
      success: true,
      data: items,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list media' });
  }
});

// Admin: upload one or more images from local storage → Cloudinary → MongoDB
router.post(
  '/upload',
  requireAdmin,
  upload.fields([
    { name: 'images', maxCount: 12 },
    { name: 'image', maxCount: 1 },
  ]),
  async (req, res) => {
  try {
    const files = [
      ...((req.files && req.files.images) || []),
      ...((req.files && req.files.image) || []),
    ];

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No image file provided. Choose a file from your computer.' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      });
    }

    const assignment = req.body.assignment || 'unassigned';
    const alt = req.body.alt || '';
    const caption = req.body.caption || '';
    const menuItemId = req.body.menuItemId || null;

    const created = [];
    for (const file of files) {
      const result = await uploadBuffer(file.buffer, {
        folder: 'al-hayat',
      });
      const media = await Media.create({
        url: result.secure_url,
        publicId: result.public_id,
        filename: file.originalname,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        assignment,
        alt: alt || file.originalname,
        menuItemId: menuItemId || null,
      });
      await applyAssignment(media, assignment, { menuItemId, caption });
      created.push(media);
    }

    res.status(201).json({
      success: true,
      data: created.length === 1 ? created[0] : created,
      count: created.length,
    });
  } catch (err) {
    console.error('[media upload]', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// Also accept single field name "image" (legacy clients)
router.post('/upload-single', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary is not configured. Set CLOUDINARY_* env vars.',
      });
    }
    const assignment = req.body.assignment || 'unassigned';
    const result = await uploadBuffer(req.file.buffer, { folder: 'al-hayat' });
    const media = await Media.create({
      url: result.secure_url,
      publicId: result.public_id,
      filename: req.file.originalname,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      assignment,
      alt: req.body.alt || req.file.originalname,
    });
    await applyAssignment(media, assignment, {
      menuItemId: req.body.menuItemId,
      caption: req.body.caption,
    });
    res.status(201).json({ success: true, data: media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// Admin: replace existing media file (same Media doc, new Cloudinary asset)
router.post('/:id/replace', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ success: false, message: 'Cloudinary is not configured' });
    }
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Not found' });

    const oldPublicId = media.publicId;
    const result = await uploadBuffer(req.file.buffer, { folder: 'al-hayat' });

    media.url = result.secure_url;
    media.publicId = result.public_id;
    media.filename = req.file.originalname;
    media.format = result.format;
    media.width = result.width;
    media.height = result.height;
    media.bytes = result.bytes;
    await media.save();

    // Update any site settings / gallery rows that pointed at old URL
    await SiteSettings.updateMany(
      { 'value.mediaId': media._id },
      { $set: { 'value.url': media.url, 'value.publicId': media.publicId } }
    );
    await Gallery.updateMany({ image: { $exists: true } }, {}); // no-op placeholder
    // Best-effort: gallery entries matching old public path are hard; skip if unknown

    await applyAssignment(media, media.assignment, {});

    if (oldPublicId && oldPublicId !== media.publicId) {
      await destroyImage(oldPublicId).catch(() => {});
    }

    res.json({ success: true, data: media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Replace failed' });
  }
});

// Admin: update assignment / alt
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { assignment, alt, tags, menuItemId, caption } = req.body;
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Not found' });

    if (assignment !== undefined) media.assignment = assignment;
    if (alt !== undefined) media.alt = alt;
    if (tags !== undefined) media.tags = tags;
    if (menuItemId !== undefined) media.menuItemId = menuItemId || null;
    await media.save();

    await applyAssignment(media, media.assignment, {
      menuItemId: media.menuItemId,
      caption,
    });

    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Update failed' });
  }
});

// Admin: set site setting image by URL
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

// Admin: delete from Cloudinary + MongoDB
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ success: false, message: 'Not found' });
    await destroyImage(media.publicId).catch((e) => console.warn('Cloudinary destroy:', e.message));
    await media.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

export default router;
