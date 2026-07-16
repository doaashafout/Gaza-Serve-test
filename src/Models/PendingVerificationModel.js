const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PendingVerification = sequelize.define('PendingVerification', {
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
  status: {
    type: DataTypes.ENUM('pending', 'resolved'),
    defaultValue: 'pending',
  },
  ai_response: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'pending_verifications',
  timestamps: true,
  underscored: true,
});

module.exports = PendingVerification;
