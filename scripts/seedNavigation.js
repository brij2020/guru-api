const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const NavigationItem = require('../models/navigationItem');

const navigationItems = [
  {
    type: 'user',
    label: 'Home',
    labelHi: 'होम',
    seo: '/',
    isPublic: true,
    isVisible: true,
    isActive: true,
    order: 1,
  },
  {
    type: 'user',
    label: 'Practice',
    labelHi: 'अभ्यास',
    seo: '/practice',
    isPublic: true,
    isVisible: true,
    isActive: true,
    order: 2,
  },
  {
    type: 'user',
    label: 'Daily Practice',
    labelHi: 'दैनिक अभ्यास',
    seo: '/daily-practice',
    isPublic: true,
    isVisible: true,
    isActive: true,
    order: 3,
  },
  {
    type: 'user',
    label: 'Government Exams',
    labelHi: 'सरकारी परीक्षा',
    seo: '/government-exams',
    isPublic: true,
    isVisible: true,
    isActive: true,
    order: 4,
  },
  {
    type: 'user',
    label: 'Study Materials',
    labelHi: 'अध्ययन सामग्री',
    seo: '/study-materials',
    isPublic: true,
    isVisible: true,
    isActive: true,
    order: 5,
  },
  {
    type: 'user',
    label: 'Test Series',
    labelHi: 'टेस्ट सीरीज',
    seo: '/test-series',
    isPublic: true,
    isVisible: true,
    isActive: true,
    order: 6,
  },
  {
    type: 'user',
    label: 'My Account',
    labelHi: 'मेरा खाता',
    seo: '/account',
    isPublic: false,
    isVisible: true,
    isActive: true,
    order: 7,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await NavigationItem.deleteMany({ type: 'user' });
    console.log('Cleared existing user navigation items');

    const inserted = await NavigationItem.insertMany(navigationItems);
    console.log(`Inserted ${inserted.length} navigation items`);

    console.log('\nSeeded navigation items:');
    inserted.forEach((item) => {
      console.log(`  - ${item.label} (${item.labelHi}) -> ${item.seo}`);
    });

    await mongoose.disconnect();
    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seed();
