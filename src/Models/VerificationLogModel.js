const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VerificationLog = sequelize.define('VerificationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  full_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  national_id_number: {
    type: DataTypes.STRING(9),
    allowNull: true,
  },
  decision: {
    type: DataTypes.ENUM('accepted', 'rejected', 'pending_review'),
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  ai_response: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'verification_logs',
  timestamps: true,
  underscored: true,
});

module.exports = VerificationLog;
