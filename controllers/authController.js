const authService = require('../services/authService');
const {
  validateRegisterPayload,
  validateLoginPayload,
  validateRefreshPayload,
} = require('../validators/authValidator');

const register = async (req, res) => {
  const payload = validateRegisterPayload(req.body);
  const result = await authService.register(payload);
  res.status(201).json({ data: result });
};

const login = async (req, res) => {
  const payload = validateLoginPayload(req.body);
  const result = await authService.login(payload);
  res.status(200).json({ data: result });
};

const refresh = async (req, res) => {
  const payload = validateRefreshPayload(req.body);
  const result = await authService.refresh(payload);
  res.status(200).json({ data: result });
};

const logout = async (req, res) => {
  await authService.logout(req.user.id);
  res.status(200).json({ message: 'Logged out successfully' });
};

const me = async (req, res) => {
  const profile = await authService.getProfile(req.user.id);
  res.status(200).json({ data: profile });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
