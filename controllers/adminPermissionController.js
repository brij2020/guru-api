const User = require("../models/user");
const crypto = require("crypto");

const SIDEBAR_PERMISSIONS = {
  dashboard: "Dashboard",
  analytics: "Analytics",
  courses: "Courses",
  stories: "Stories",
  tests: "Tests",
  manageAIMeta: "Manage AI Meta Data",
  paperBlueprints: "Paper Blueprints",
  questionCoverage: "Question Coverage",
  questionFactory: "Question Factory",
  questionPublisher: "Question Publisher",
  questionBulkUpload: "Question Bulk Upload",
  itExamBulkUpload: "IT Exam Bulk Upload",
  questionEditor: "Question Editor",
  questionAssets: "Question Assets",
  questionImport: "Question Import",
  questionReview: "Question Review",
  draftExamPreview: "Draft Exam Preview",
  users: "Users",
  motivationalQuotes: "Motivational Quotes",
  sarkariJobUpdates: "Sarkari Job Updates",
  permissions: "Permissions"
};

const PERMISSION_LEVELS = [
  { value: "none", label: "No Access" },
  { value: "read", label: "Read Only" },
  { value: "write", label: "Create and Edit" },
  { value: "manage", label: "Full Access" }
];

const VALID_ROLES = ["editor", "reviewer", "admin", "super_admin"];

const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({
      role: { $in: ["admin", "super_admin", "editor", "reviewer"] }
    }).select("name email role adminPermissions createdAt");

    res.json({
      success: true,
      data: { admins, sections: SIDEBAR_PERMISSIONS, levels: PERMISSION_LEVELS }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get admins" });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { email, name, role, permissions, password } = req.body;

    if (!email || !name || !role || !password) {
      return res.status(400).json({ success: false, error: "All fields required" });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: "Invalid role" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User exists" });
    }

    const referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    const newAdmin = new User({
      name, email: email.toLowerCase(), password, role, referralCode,
      adminPermissions: permissions || {},
      isEmailVerified: true, active: true
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      data: { admin: { _id: newAdmin._id, name, email, role, adminPermissions: newAdmin.adminPermissions } }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create admin" });
  }
};

const getAdminById = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id).select("name email role adminPermissions");
    if (!admin) return res.status(404).json({ success: false, error: "Admin not found" });
    res.json({ success: true, data: { admin, sections: SIDEBAR_PERMISSIONS, levels: PERMISSION_LEVELS } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get admin" });
  }
};

const updateAdminPermissions = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, error: "Admin not found" });
    if (admin.role === "super_admin") return res.status(403).json({ success: false, error: "Cannot modify super admin" });

    if (req.body.permissions && typeof req.body.permissions === "object") {
      admin.adminPermissions = req.body.permissions;
      await admin.save();
    }

    res.json({
      success: true,
      data: { admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role, adminPermissions: admin.adminPermissions } }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update permissions" });
  }
};

const checkPermission = async (req, res) => {
  try {
    const { section, level = "read" } = req.query;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    if (user.role === "super_admin") return res.json({ success: true, data: { hasPermission: true } });

    const levelHierarchy = { none: 0, read: 1, write: 2, manage: 3 };
    const userLevel = user.adminPermissions?.[section] || "none";
    const hasPermission = levelHierarchy[userLevel] >= levelHierarchy[level];

    res.json({ success: true, data: { hasPermission, section, level, userLevel } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to check permission" });
  }
};

const getMyPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email role adminPermissions");
    if (!user) return res.status(404).json({ success: false, error: "User not found" });
    res.json({ success: true, data: { user: { _id: user._id, name: user.name, email: user.email, role: user.role }, permissions: user.adminPermissions } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get permissions" });
  }
};

module.exports = { getAllAdmins, createAdmin, getAdminById, updateAdminPermissions, checkPermission, getMyPermissions };
