const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Request = require('./RequestModel');

const Rating = sequelize.define('Rating', {
  rating_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: Request,
      key: 'request_id',
    },
    validate: {
      notEmpty: { msg: 'معرف الطلب مطلوب' },
    },
  },
  stars: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: { args: [1], msg: 'التقييم يجب أن يكون 1 نجمة على الأقل' },
      max: { args: [5], msg: 'التقييم يجب أن يكون 5 نجوم كحد أقصى' },
    },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'ratings',
  timestamps: true,
  underscored: true,
});

module.exports = Rating;
