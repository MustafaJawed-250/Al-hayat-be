/**
 * Idempotent seed — never overwrites existing menu items by name.
 * Uses real AL HAYAT menu: selling price = price, originalPrice = list price.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Category from '../models/Category.js';
import MenuItem from '../models/MenuItem.js';
import Gallery from '../models/Gallery.js';
import SiteSettings from '../models/SiteSettings.js';

dotenv.config();

const categoriesData = [
  { name: 'Special Discount', slug: 'special-discount', order: 1, isActive: true },
  { name: 'Bar BQ', slug: 'bar-bq', order: 2, isActive: true },
  { name: 'Burgers & Bun', slug: 'burgers-bun', order: 3, isActive: true },
  { name: 'Sandwiches', slug: 'sandwiches', order: 4, isActive: true },
  { name: 'Broast', slug: 'broast', order: 5, isActive: true },
  { name: 'Rolls', slug: 'rolls', order: 6, isActive: true },
  { name: 'Fries', slug: 'fries', order: 7, isActive: true },
  { name: 'Paratha', slug: 'paratha', order: 8, isActive: true },
  { name: 'Beverages', slug: 'beverages', order: 9, isActive: true },
];

// Curated Unsplash fallbacks by dish type (replaceable via admin Media Library)
const IMG = {
  zinger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80',
  shawarma: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&q=80',
  broast: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=800&q=80',
  club: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80',
  tikka: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f3?w=800&q=80',
  boti: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=800&q=80',
  kabab: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80',
  burger: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80',
  bun: 'https://images.unsplash.com/photo-1551782450-17144efb9c50?w=800&q=80',
  roll: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=800&q=80',
  fries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80',
  paratha: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
  pepsi: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800&q=80',
  soda: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7de?w=800&q=80',
  cheeseBurger: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=800&q=80',
  sandwich: 'https://images.unsplash.com/photo-1481070414801-51fd732d7184?w=800&q=80',
};

const itemsData = [
  // SPECIAL DISCOUNT
  { name: 'Zinger Burger', price: 510, originalPrice: 600, categorySlug: 'special-discount', description: 'Fries with coleslaw', image: IMG.zinger, isFeatured: true },
  { name: 'Shawarma', price: 255, originalPrice: 300, categorySlug: 'special-discount', description: 'Regular', image: IMG.shawarma, isFeatured: true },
  { name: 'Cheese Shawarma', price: 306, originalPrice: 360, categorySlug: 'special-discount', description: 'Cheesy shawarma', image: IMG.shawarma },
  { name: 'Breast Broast', price: 595, originalPrice: 700, categorySlug: 'special-discount', description: 'With fries, coleslaw and sauces', image: IMG.broast, isFeatured: true },
  { name: 'Club Sandwich', price: 510, originalPrice: 600, categorySlug: 'special-discount', description: 'With fries and coleslaw', image: IMG.club },

  // BAR BQ
  { name: 'Chicken Leg Tikka', price: 425, originalPrice: 500, categorySlug: 'bar-bq', description: 'Chicken leg tikka with raita and salad', image: IMG.tikka, isFeatured: true },
  { name: 'Chicken Bihari Tikka', price: 510, originalPrice: 600, categorySlug: 'bar-bq', description: '3 pieces with raita and salad', image: IMG.tikka },
  { name: 'Chicken Boti', price: 340, originalPrice: 400, categorySlug: 'bar-bq', description: '1 seekh with raita and salad', image: IMG.boti, isFromPrice: true },
  { name: 'Chicken Malai Boti', price: 340, originalPrice: 400, categorySlug: 'bar-bq', description: '1 seekh with raita and salad', image: IMG.boti, isFromPrice: true },
  { name: 'Chicken Reshmi Kabab', price: 340, originalPrice: 400, categorySlug: 'bar-bq', description: '1 seekh with salad and raita', image: IMG.kabab, isFromPrice: true },
  { name: 'Chicken Chest Tikka', price: 510, originalPrice: 600, categorySlug: 'bar-bq', description: 'Chicken chest tikka with raita and salad', image: IMG.tikka },

  // BURGERS & BUN
  { name: 'Zinger Cheese Burger', price: 595, originalPrice: 700, categorySlug: 'burgers-bun', description: 'Fries with coleslaw', image: IMG.cheeseBurger, isFeatured: true },
  { name: 'Zinger Burger Without Fries & Coleslaw', price: 467.5, originalPrice: 550, categorySlug: 'burgers-bun', description: 'Special mayo, crispy zinger piece, chilli ketchup and burger bun', image: IMG.zinger },
  { name: 'Zinger Cheese Burger Without Fries & Coleslaw', price: 510, originalPrice: 600, categorySlug: 'burgers-bun', description: 'Special mayo, crispy zinger piece, cheese slice, chilli ketchup and burger bun', image: IMG.cheeseBurger },
  { name: 'Chicken Chapli Burger', price: 425, originalPrice: 500, categorySlug: 'burgers-bun', description: 'With fries and coleslaw', image: IMG.burger },
  { name: 'Chicken Chapli Cheese Burger', price: 467.5, originalPrice: 550, categorySlug: 'burgers-bun', description: 'With fries and coleslaw', image: IMG.cheeseBurger },
  { name: 'Chicken Burger', price: 425, originalPrice: 500, categorySlug: 'burgers-bun', description: 'With fries and coleslaw', image: IMG.burger },
  { name: 'Chicken Cheese Burger', price: 467.5, originalPrice: 550, categorySlug: 'burgers-bun', description: 'With fries and coleslaw', image: IMG.cheeseBurger },
  { name: 'Zinger Saucy Burger', price: 595, originalPrice: 700, categorySlug: 'burgers-bun', description: 'Extra saucy with fries and coleslaw', image: IMG.zinger },
  { name: 'Bun Kabab', price: 93.5, originalPrice: 110, categorySlug: 'burgers-bun', description: 'Spicy and delicious', image: IMG.bun, isFromPrice: true },
  { name: 'Double Bun with Single Kabab', price: 112.2, originalPrice: 132, categorySlug: 'burgers-bun', description: 'Spicy and delicious', image: IMG.bun },
  { name: 'Egg Bun Kabab', price: 196.35, originalPrice: 231, categorySlug: 'burgers-bun', description: 'Spicy and delicious', image: IMG.bun },

  // SANDWICHES
  { name: 'Club Cheese Sandwich', price: 510, originalPrice: 600, categorySlug: 'sandwiches', description: 'With fries and coleslaw', image: IMG.club },
  { name: 'Zinger Club Sandwich', price: 595, originalPrice: 700, categorySlug: 'sandwiches', description: 'With fries and coleslaw', image: IMG.sandwich },
  { name: 'Zinger Club Cheese Sandwich', price: 637.5, originalPrice: 750, categorySlug: 'sandwiches', description: 'With fries and coleslaw', image: IMG.sandwich },
  { name: 'Chicken Sandwich', price: 467.5, originalPrice: 550, categorySlug: 'sandwiches', description: 'With fries and coleslaw', image: IMG.sandwich },
  { name: 'Chicken Cheese Sandwich', price: 510, originalPrice: 600, categorySlug: 'sandwiches', description: 'With fries and coleslaw', image: IMG.club },
  { name: 'BBQ Club Sandwich', price: 680, originalPrice: 800, categorySlug: 'sandwiches', description: 'With fries and coleslaw', image: IMG.club },
  { name: 'BBQ Club Cheese Sandwich', price: 765, originalPrice: 900, categorySlug: 'sandwiches', description: 'With fries and coleslaw', image: IMG.sandwich },
  { name: 'Siriracha Club Sandwich With Fries', price: 595, originalPrice: 700, categorySlug: 'sandwiches', description: 'Siriracha sauce, slice, special mayo, egg, smoked pepperoni slices, onion, tomato, cucumber and fries', image: IMG.sandwich },

  // BROAST
  { name: 'Masala Broast', price: 595, originalPrice: 700, categorySlug: 'broast', description: 'Masala broast with fries and raita dip', image: IMG.broast },
  { name: 'Saucy Breast Broast', price: 637.5, originalPrice: 750, categorySlug: 'broast', description: 'Extra saucy with fries and coleslaw', image: IMG.broast },

  // ROLLS
  { name: 'Chicken Mayo Boti Roll', price: 297.5, originalPrice: 350, categorySlug: 'rolls', description: 'Single serving', image: IMG.roll },
  { name: 'Chicken Garlic Mayo Boti Roll', price: 297.5, originalPrice: 350, categorySlug: 'rolls', description: 'Chicken roll', image: IMG.roll },
  { name: 'Cheese Chicken Roll', price: 297.5, originalPrice: 350, categorySlug: 'rolls', description: 'Cheese chicken roll', image: IMG.roll },
  { name: 'Malai Boti Roll', price: 255, originalPrice: 300, categorySlug: 'rolls', description: 'Tender chicken malai boti wrapped in a roll', image: IMG.roll, isFeatured: true },
  { name: 'Malai Boti Mayo Roll', price: 340, originalPrice: 400, categorySlug: 'rolls', description: 'Mayo roll', image: IMG.roll },
  { name: 'Malai Boti Garlic Mayo Roll', price: 340, originalPrice: 400, categorySlug: 'rolls', description: 'Garlic mayo roll', image: IMG.roll },
  { name: 'Cheese Malai Boti Roll', price: 340, originalPrice: 400, categorySlug: 'rolls', description: 'Cheese malai boti roll', image: IMG.roll },
  { name: 'Zinger Mayo Roll With Fries', price: 382.5, originalPrice: 450, categorySlug: 'rolls', description: 'Zinger, chilli mayo, paratha and fries', image: IMG.roll },
  { name: 'Chicken Boti Roll', price: 255, originalPrice: 300, categorySlug: 'rolls', description: 'Tender chicken boti wrapped in a warm, flaky paratha', image: IMG.roll },

  // FRIES
  { name: 'Plain Salty Fries', price: 212.5, originalPrice: 250, categorySlug: 'fries', description: 'Pure potato fries served with ketchup', image: IMG.fries },
  { name: 'Saucy Fries', price: 255, originalPrice: 300, categorySlug: 'fries', description: 'Potato fries topped with spicy sauce', image: IMG.fries },

  // PARATHA
  { name: 'Paratha', price: 68, originalPrice: 80, categorySlug: 'paratha', description: 'Single serving', image: IMG.paratha, isFromPrice: true },

  // BEVERAGES
  { name: 'Pepsi - 345 ml', price: 127.5, originalPrice: 150, categorySlug: 'beverages', description: 'Refreshing cola', image: IMG.pepsi },
  { name: '7up - 345 ml', price: 127.5, originalPrice: 150, categorySlug: 'beverages', description: 'Refreshing lemon-lime soda', image: IMG.soda },
];

const galleryData = [
  { image: IMG.tikka, caption: 'Charcoal-grilled tikka', order: 1 },
  { image: IMG.roll, caption: 'Fresh rolls', order: 2 },
  { image: IMG.burger, caption: 'Burgers', order: 3 },
  { image: IMG.broast, caption: 'Crispy broast', order: 4 },
  { image: IMG.shawarma, caption: 'Shawarma', order: 5 },
  { image: IMG.boti, caption: 'BBQ platters', order: 6 },
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const catMap = {};
  for (const c of categoriesData) {
    const cat = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $set: { name: c.name, order: c.order, isActive: c.isActive }, $setOnInsert: { slug: c.slug } },
      { upsert: true, new: true }
    );
    catMap[c.slug] = cat._id;
    console.log('Category:', cat.name);
  }

  let inserted = 0;
  let skipped = 0;
  for (const item of itemsData) {
    const existing = await MenuItem.findOne({ name: item.name });
    if (existing) {
      skipped += 1;
      continue;
    }
    const { categorySlug, ...rest } = item;
    await MenuItem.create({
      ...rest,
      category: catMap[categorySlug],
      slug: slugify(item.name),
      isAvailable: true,
      chef: 'AL HAYAT Kitchen',
      kitchen: 'AL HAYAT',
    });
    inserted += 1;
    console.log('+', item.name, 'Rs.', item.price);
  }
  console.log(`Menu: ${inserted} inserted, ${skipped} already present (preserved)`);

  // Gallery – only if empty
  const gCount = await Gallery.countDocuments();
  if (gCount === 0) {
    await Gallery.insertMany(galleryData);
    console.log('Gallery seeded');
  } else {
    console.log('Gallery already has items, skip');
  }

  // Default site settings (hero image)
  await SiteSettings.findOneAndUpdate(
    { key: 'home-hero' },
    { $setOnInsert: { key: 'home-hero', value: { url: IMG.boti, publicId: '' } } },
    { upsert: true }
  );
  await SiteSettings.findOneAndUpdate(
    { key: 'about-main' },
    { $setOnInsert: { key: 'about-main', value: { url: 'https://images.unsplash.com/photo-1555939596-5761c9d0d0e0?w=900&q=80', publicId: '' } } },
    { upsert: true }
  );

  if (process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    console.log('Admin password hash (set ADMIN_PASSWORD_HASH in .env):');
    console.log(hash);
  }

  console.log(`Total catalog items defined: ${itemsData.length}`);
  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
