const express = require("express");
const router = express.Router();
const isAdmin = require("../../../middleware/isAdmin");
const { 
  getAllAdmins, 
  createAdmin,
  getAdminById, 
  updateAdminPermissions,
  checkPermission,
  getMyPermissions 
} = require("../../../controllers/adminPermissionController");

router.get("/", isAdmin, getAllAdmins);
router.post("/", isAdmin, createAdmin);
router.get("/me", isAdmin, getMyPermissions);
router.get("/check", isAdmin, checkPermission);
router.get("/:id", isAdmin, getAdminById);
router.put("/:id", isAdmin, updateAdminPermissions);

module.exports = (app) => {
  app.use("/api/v1/admin/permissions", router);
};
