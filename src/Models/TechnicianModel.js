const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Technician = sequelize.define('Technician', {
  tech_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'معرف تليغرام مطلوب' },
    },
  },
  full_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'الاسم الثلاثي مطلوب' },
      len: {
        args: [3, 150],
        msg: 'يجب أن يكون الاسم بين 3 إلى 150 حرفاً',
      },
    },
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'رقم الهاتف مطلوب' },
      is: {
        args: /^[0-9+\s-]+$/i,
        msg: 'يرجى إدخال رقم هاتف صحيح',
      },
    },
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'التخصص المهني مطلوب' },
    },
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'النطاق الجغرافي مطلوب' },
    },
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  rating_avg: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.00,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
}, {
  tableName: 'technicians',
  timestamps: true,
  underscored: true,
});

module.exports = Technician;
