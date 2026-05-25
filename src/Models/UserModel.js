const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'معرف تليغرام مطلوب ولا يمكن أن يكون فارغاً' },
    },
  },
  full_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'اسم المستخدم مطلوب' },
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
      notEmpty: { msg: 'رقم الهاتف مطلوب للتواصل ميدانياً' },
      is: {
        args: /^[0-9+\s-]+$/i,
        msg: 'يرجى إدخال رقم هاتف صحيح',
      },
    },
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'المنطقة السكنية مطلوبة' },
    },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

module.exports = User;
