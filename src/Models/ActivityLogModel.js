const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
  log_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  admin_id: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING(100), allowNull: false },
  details: { type: DataTypes.TEXT, allowNull: true },
  target_type: { type: DataTypes.STRING(50), allowNull: true },
  target_id: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'activity_logs', timestamps: true, createdAt: 'created_at', updatedAt: false });

module.exports = ActivityLog;
