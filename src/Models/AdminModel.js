const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  admin_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  telegram_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  role: { type: DataTypes.ENUM('super_admin', 'support_admin', 'moderator'), defaultValue: 'moderator' },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'admins', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = Admin;
