const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./UserModel');
const Technician = require('./TechnicianModel');

const Request = sequelize.define('Request', {
  request_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  client_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: User,
      key: 'user_id',
    },
    validate: {
      notEmpty: { msg: 'معرف الزبون مطلوب' },
    },
  },
  tech_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: Technician,
      key: 'tech_id',
    },
  },
  extracted_category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'التخصص المستخرج مطلوب' },
    },
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  detailed_address: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  problem_description: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'وصف المشكلة مطلوب' },
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'canceled'),
    defaultValue: 'pending',
  },
  voice_note_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'service_requests',
  timestamps: true,
  underscored: true,
});

module.exports = Request;
