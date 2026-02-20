const User = require('../models/user');
const { logger } = require('../config/logger');
const {
  seedAdminOnBoot,
  seedAdminName,
  seedAdminEmail,
  seedAdminPassword,
} = require('../config/env');

const seedAdminUser = async () => {
  console.log("seedAdminOnBoot",seedAdminOnBoot)
  if (!seedAdminOnBoot) return;

  if (!seedAdminName || !seedAdminEmail || !seedAdminPassword) {
    logger.warn(
      'Admin seed skipped: set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD to enable'
    );
    return;
  }

  const email = seedAdminEmail.trim().toLowerCase();
  const existing = await User.findOne({ email });
    console.log("existing======", existing)
  if (!existing) {
    await User.create({
      name: seedAdminName.trim(),
      email,
      password: seedAdminPassword,
      role: 'admin',
    });
    logger.info(`Admin user seeded: ${email}`);
    return;
  }

  let changed = false;
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    changed = true;
  }
  if (seedAdminName.trim() && existing.name !== seedAdminName.trim()) {
    existing.name = seedAdminName.trim();
    changed = true;
  }

  if (changed) {
    await existing.save();
    logger.info(`Admin user updated: ${email}`);
    return;
  }

  logger.info(`Admin user already exists: ${email}`);
};

module.exports = {
  seedAdminUser,
};
