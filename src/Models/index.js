'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────
const User = sequelize.define('User', {
  user_id:      { type: DataTypes.BIGINT, primaryKey: true, allowNull: false },
  full_name:    { type: DataTypes.STRING(150), allowNull: false, defaultValue: 'مستخدم' },
  phone_number: { type: DataTypes.STRING(25),  allowNull: false, defaultValue: '—' },
  location:     { type: DataTypes.STRING(100), allowNull: true },
  username:     { type: DataTypes.STRING(100), allowNull: true },
  is_active:    { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'users', timestamps: true, underscored: true });

// ─────────────────────────────────────────────
// TECHNICIAN
// ─────────────────────────────────────────────
const Technician = sequelize.define('Technician', {
  tech_id:      { type: DataTypes.BIGINT, primaryKey: true, allowNull: false },
  full_name:    { type: DataTypes.STRING(150), allowNull: false },
  phone_number: { type: DataTypes.STRING(25),  allowNull: false },
  category:     { type: DataTypes.STRING(100), allowNull: false },
  location:     { type: DataTypes.STRING(100), allowNull: false },
  is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  rating_avg:   { type: DataTypes.DECIMAL(3,2), defaultValue: 0.00 },
  total_jobs:   { type: DataTypes.INTEGER, defaultValue: 0 },
  status:       { type: DataTypes.ENUM('pending','approved','rejected'), defaultValue: 'pending' },
  username:     { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: 'technicians', timestamps: true, underscored: true });

// ─────────────────────────────────────────────
// SERVICE REQUEST
// ─────────────────────────────────────────────
const Request = sequelize.define('Request', {
  request_id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  client_id:           { type: DataTypes.BIGINT, allowNull: false },
  tech_id:             { type: DataTypes.BIGINT, allowNull: true },
  extracted_category:  { type: DataTypes.STRING(100), allowNull: false },
  location:            { type: DataTypes.STRING(150), allowNull: true },
  detailed_address:    { type: DataTypes.STRING(400), allowNull: true },
  problem_description: { type: DataTypes.TEXT, allowNull: true },
  photo_file_id:       { type: DataTypes.STRING(500), allowNull: true },
  scheduled_date:      { type: DataTypes.DATEONLY, allowNull: true },
  scheduled_time:      { type: DataTypes.STRING(30), allowNull: true },
  status: {
    type: DataTypes.ENUM('pending','accepted','on_the_way','in_progress','completed','canceled','archived'),
    defaultValue: 'pending',
  },
  is_archived:   { type: DataTypes.BOOLEAN, defaultValue: false },
  client_phone:  { type: DataTypes.STRING(25), allowNull: true },
}, { tableName: 'service_requests', timestamps: true, underscored: true });

// ─────────────────────────────────────────────
// RATING
// ─────────────────────────────────────────────
const Rating = sequelize.define('Rating', {
  rating_id:  { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  request_id: { type: DataTypes.INTEGER, allowNull: false },
  stars:      { type: DataTypes.TINYINT, allowNull: false },
  comment:    { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'ratings', timestamps: true, underscored: true });

// ─────────────────────────────────────────────
// SUPPORT TICKET
// ─────────────────────────────────────────────
const SupportTicket = sequelize.define('SupportTicket', {
  ticket_id:   { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id:     { type: DataTypes.BIGINT, allowNull: false },
  message:     { type: DataTypes.TEXT, allowNull: false },
  admin_reply: { type: DataTypes.TEXT, allowNull: true },
  status:      { type: DataTypes.ENUM('open','replied','closed'), defaultValue: 'open' },
}, { tableName: 'support_tickets', timestamps: true, underscored: true });

// ─────────────────────────────────────────────
// CATEGORY
// ─────────────────────────────────────────────
const Category = sequelize.define('Category', {
  category_id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name_ar:     { type: DataTypes.STRING(100), allowNull: false },
  name_en:     { type: DataTypes.STRING(100), allowNull: false },
  icon:        { type: DataTypes.STRING(10), defaultValue: '🔧' },
  is_active:   { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'categories', timestamps: true, underscored: true });

// ─────────────────────────────────────────────
// ASSOCIATIONS
// ─────────────────────────────────────────────
User.hasMany(Request,       { foreignKey: 'client_id', as: 'requests' });
Request.belongsTo(User,     { foreignKey: 'client_id', as: 'client' });

Technician.hasMany(Request, { foreignKey: 'tech_id', as: 'assignedRequests' });
Request.belongsTo(Technician, { foreignKey: 'tech_id', as: 'technician' });

Request.hasOne(Rating,      { foreignKey: 'request_id', as: 'rating' });
Rating.belongsTo(Request,   { foreignKey: 'request_id', as: 'request' });

User.hasMany(SupportTicket, { foreignKey: 'user_id', as: 'tickets' });
SupportTicket.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { User, Technician, Request, Rating, SupportTicket, Category, sequelize };
