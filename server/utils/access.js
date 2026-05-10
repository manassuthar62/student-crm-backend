const Center = require('../models/Center');

const isAdmin = (user) => user?.role?.toLowerCase() === 'admin';
const isCenterRole = (user) => ['center', 'staff'].includes(user?.role?.toLowerCase());

const toId = (value) => {
  if (!value) return null;
  return String(value._id || value);
};

const getCenterIdsForUser = async (user) => {
  if (!user?._id) return [];

  const centers = await Center.find({
    userId: user._id,
    isActive: { $ne: false }
  }).select('_id');

  return centers.map((center) => center._id);
};

const getOwnedStudentFilter = async (user) => {
  if (isAdmin(user)) return {};
  if (!isCenterRole(user)) return { _id: null };

  const centerIds = await getCenterIdsForUser(user);
  const ownerIds = [user._id, ...centerIds];

  return {
    $or: [
      { addedBy: user._id },
      { registeredBy: user._id },
      { center: { $in: ownerIds } }
    ]
  };
};

const canAccessStudent = async (user, student) => {
  if (isAdmin(user)) return true;
  if (!isCenterRole(user) || !student) return false;

  const centerIds = await getCenterIdsForUser(user);
  const allowedIds = new Set([user._id, ...centerIds].map(toId).filter(Boolean));
  const studentOwners = [
    student.addedBy,
    student.registeredBy,
    student.center
  ].map(toId);

  return studentOwners.some((id) => id && allowedIds.has(id));
};

module.exports = {
  canAccessStudent,
  getOwnedStudentFilter,
  isAdmin,
  isCenterRole
};
