const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  category_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name_ar: { type: DataTypes.STRING(100), allowNull: false },
  name_en: { type: DataTypes.STRING(100), allowNull: false },
  icon: { type: DataTypes.STRING(10), defaultValue: '🔧' },
}, { tableName: 'categories', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

module.exports = Category;
