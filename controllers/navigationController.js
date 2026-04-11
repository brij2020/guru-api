const navigationService = require('../services/navigationService');
const ApiError = require('../errors/apiError');

const getPortalNavigation = async (req, res) => {
  const items = await navigationService.getPublicNavigation('user');
  res.json({ data: items });
};

const getNavigation = async (req, res) => {
  const { type = 'user' } = req.query || {};
  const items = await navigationService.getNavigation(req.user.id, type);
  res.json({ data: items });
};

const getAdminList = async (req, res) => {
  const { type = 'user' } = req.query || {};
  const items = await navigationService.getAllItems(type);
  res.json({ data: items });
};

const upsertItem = async (req, res) => {
  const { role } = req.user || {};
  if (role !== 'admin' && role !== 'super_admin') {
    throw new ApiError(403, 'Only admin can manage navigation');
  }
  const payload = req.body;
  if (req.params.itemId) {
    payload._id = req.params.itemId;
  }
  const item = await navigationService.upsertNavigationItem(req.user.id, payload);
  res.json({ data: item });
};

const deleteItem = async (req, res) => {
  const { role } = req.user || {};
  if (role !== 'admin' && role !== 'super_admin') {
    throw new ApiError(403, 'Only admin can manage navigation');
  }
  await navigationService.deleteNavigationItem(req.user.id, req.params.itemId);
  res.json({ success: true });
};

const reorder = async (req, res) => {
  const { role } = req.user || {};
  if (role !== 'admin' && role !== 'super_admin') {
    throw new ApiError(403, 'Only admin can manage navigation');
  }
  const { type, orderedIds } = req.body;
  await navigationService.reorderNavigation(req.user.id, type, orderedIds);
  res.json({ success: true });
};

const resetDefault = async (req, res) => {
  const { role } = req.user || {};
  if (role !== 'admin' && role !== 'super_admin') {
    throw new ApiError(403, 'Only admin can manage navigation');
  }
  const { type = 'admin' } = req.body;
  await navigationService.resetToDefault(req.user.id, type);
  const items = await navigationService.getNavigation(req.user.id, type);
  res.json({ data: items });
};

module.exports = { getPortalNavigation, getNavigation, getAdminList, upsertItem, deleteItem, reorder, resetDefault };
