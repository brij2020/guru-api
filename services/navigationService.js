const mongoose = require('mongoose');
const ApiError = require('../errors/apiError');
const NavigationItem = require('../models/navigationItem');
const { logger } = require('../config/logger');

const isAdmin = (role) => ['admin', 'super_admin'].includes(role);

const DEFAULT_ADMIN_SIDEBAR = [
  { label: 'Dashboard', seo: '/dashboard', permission: 'dashboard', minRole: 'admin', order: 1 },
  { label: 'Logs', seo: '/logs', permission: 'logs', minRole: 'admin', order: 2 },
  { label: 'Analytics', seo: '/analytics', permission: 'analytics', minRole: 'admin', order: 3 },
  { label: 'Courses', seo: '/courses', permission: 'courses', order: 4 },
  { label: 'Tests', seo: '/tests', permission: 'tests', order: 5 },
  { label: 'Manage AI Meta Data', seo: '/tests/ai-meta', permission: 'manageAIMeta', order: 6 },
  { label: 'Paper Blueprints', seo: '/tests/paper-blueprints', permission: 'paperBlueprints', order: 7 },
  { label: 'Question Coverage', seo: '/tests/question-coverage', permission: 'questionCoverage', order: 8 },
  { label: 'Question Factory', seo: '/tests/question-factory', permission: 'questionFactory', order: 9 },
  { label: 'Question Publisher', seo: '/tests/question-publisher', permission: 'questionPublisher', order: 10 },
  { label: 'Question Bulk Upload', seo: '/tests/question-bulk-upload', permission: 'questionBulkUpload', order: 11 },
  { label: 'IT Exam Bulk Upload', seo: '/tests/it-exam-bulk-upload', permission: 'itExamBulkUpload', order: 12 },
  { label: 'Question Editor', seo: '/tests/question-editor', permission: 'questionEditor', order: 13 },
  { label: 'Question Assets', seo: '/tests/question-assets', permission: 'questionAssets', order: 14 },
  { label: 'Question Import', seo: '/tests/question-import', permission: 'questionImport', order: 15 },
  { label: 'Question Review', seo: '/tests/question-review', permission: 'questionReview', order: 16 },
  { label: 'Draft Exam Preview', seo: '/tests/draft-exam', permission: 'draftExamPreview', order: 17 },
  { label: 'PDF Extractor', seo: '/tests/pdf-extract', permission: 'pdfExtractor', order: 18 },
  { label: 'Users', seo: '/users', permission: 'users', minRole: 'admin', order: 19 },
  { label: 'Stories', seo: '/stories', permission: 'stories', order: 20 },
  { label: 'Motivational Quotes', seo: '/motivational-quotes', permission: 'motivationalQuotes', order: 21 },
  { label: 'Sarkari Job Updates', seo: '/sarkari-job-updates', permission: 'sarkariJobUpdates', order: 22 },
  { label: 'Permissions', seo: '/permissions', minRole: 'super_admin', order: 23 },
];

const DEFAULT_USER_NAV = [
  { label: 'Dashboard', seo: '/user/dashboard', order: 1 },
  { label: 'My Course', seo: '/user/myCourse', order: 2 },
  { label: 'My Profile', seo: '/user/myProfile', order: 3 },
  { label: 'My Certificate', seo: '/user/myCertificates', order: 4 },
  { label: 'Referral', seo: '/user/referral', order: 5 },
];

const createDefaultNavigation = async (ownerId, type) => {
  const defaults = type === 'admin' ? DEFAULT_ADMIN_SIDEBAR : DEFAULT_USER_NAV;
  const items = defaults.map(item => ({
    ...item,
    owner: ownerId,
    type,
  }));
  return NavigationItem.insertMany(items);
};

const getNavigation = async (ownerId, type) => {
  const items = await NavigationItem.find({ owner: ownerId, type, isActive: true })
    .sort({ order: 1 })
    .lean();
  
  const rootItems = items.filter(item => !item.parentId);
  const childItems = items.filter(item => item.parentId);
  
  const buildTree = (parent) => {
    const children = childItems
      .filter(item => item.parentId?.toString() === parent._id?.toString())
      .map(child => ({
        ...child,
        children: buildTree(child),
      }));
    return children.length > 0 ? { ...parent, children } : parent;
  };
  
  return rootItems.map(buildTree);
};

const getPublicNavigation = async (type) => {
  const items = await NavigationItem.find({ type, isActive: true, isPublic: true })
    .sort({ order: 1 })
    .lean();
  
  const rootItems = items.filter(item => !item.parentId);
  const childItems = items.filter(item => item.parentId);
  
  const buildTree = (parent) => {
    const children = childItems
      .filter(item => item.parentId?.toString() === parent._id?.toString())
      .map(child => buildTree(child));
    
    return {
      label: parent.label,
      labelHi: parent.labelHi,
      seo: parent.seo,
      children,
    };
  };
  
  return rootItems.map(buildTree);
};

const getAllItems = async (type) => {
  const items = await NavigationItem.find({ type, isActive: true })
    .sort({ order: 1 })
    .lean();
  
  const rootItems = items.filter(item => !item.parentId);
  const childItems = items.filter(item => item.parentId);
  
  const buildTree = (parent) => {
    const children = childItems
      .filter(item => item.parentId?.toString() === parent._id?.toString())
      .map(child => buildTree(child));
    return { ...parent, children };
  };
  
  return rootItems.map(buildTree);
};

const upsertNavigationItem = async (ownerId, payload) => {
  const { _id, owner, ...data } = payload;
  const finalOwner = owner === undefined ? ownerId : owner;
  
  if (_id) {
    const item = await NavigationItem.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(_id) },
      { $set: { ...data, owner: finalOwner } },
      { new: true }
    );
    if (!item) throw new ApiError(404, 'Navigation item not found');
    return item;
  }
  
  return NavigationItem.create({ ...data, owner: finalOwner });
};

const deleteNavigationItem = async (ownerId, itemId) => {
  const item = await NavigationItem.findOneAndDelete({ _id: new mongoose.Types.ObjectId(itemId) });
  if (!item) throw new ApiError(404, 'Navigation item not found');
  
  await NavigationItem.deleteMany({ parentId: itemId });
  
  return { success: true };
};

const reorderNavigation = async (ownerId, type, orderedIds) => {
  const bulkOps = orderedIds.map((id, index) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(id), type },
      update: { $set: { order: index + 1 } },
    },
  }));
  
  await NavigationItem.bulkWrite(bulkOps);
  return { success: true };
};

const resetToDefault = async (ownerId, type) => {
  await NavigationItem.deleteMany({ owner: ownerId, type });
  await createDefaultNavigation(ownerId, type);
  return { success: true };
};

module.exports = {
  getNavigation,
  getPublicNavigation,
  getAllItems,
  upsertNavigationItem,
  deleteNavigationItem,
  reorderNavigation,
  resetToDefault,
  createDefaultNavigation,
};