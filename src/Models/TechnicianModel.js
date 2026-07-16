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
  national_id_number: {
    type: DataTypes.STRING(9),
    allowNull: true,
    validate: {
      is: /^\d{9}$/,
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
  governorate: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  experience_years: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  skills: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  work_description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  national_id_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  profile_photo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  certificates: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON array of certificate file URLs',
  },
  has_certificate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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
