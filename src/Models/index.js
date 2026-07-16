const User = require('./UserModel');
const Technician = require('./TechnicianModel');
const Request = require('./RequestModel');
const SupportTicket = require('./SupportTicketModel');
const Category = require('./CategoryModel');
const PendingVerification = require('./PendingVerificationModel');
const VerificationLog = require('./VerificationLogModel');

// User -> Request (1 to Many)
User.hasMany(Request, { foreignKey: 'client_id', as: 'requests' });
Request.belongsTo(User, { foreignKey: 'client_id', as: 'client' });

// Technician -> Request (1 to Many)
Technician.hasMany(Request, { foreignKey: 'tech_id', as: 'assignedRequests' });
Request.belongsTo(Technician, { foreignKey: 'tech_id', as: 'technician' });

// User -> SupportTicket (1 to Many)
User.hasMany(SupportTicket, { foreignKey: 'user_id', as: 'tickets' });
SupportTicket.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Category -> Technician (logical relation, no FK constraint)
Category.hasMany(Technician, { foreignKey: 'category', sourceKey: 'name_ar', as: 'technicians', constraints: false });
Technician.belongsTo(Category, { foreignKey: 'category', targetKey: 'name_ar', as: 'categoryInfo', constraints: false });

// Category -> Request (1 to Many, no FK constraint)
Category.hasMany(Request, { foreignKey: 'extracted_category', sourceKey: 'name_ar', as: 'requestsByCategory', constraints: false });

module.exports = { User, Technician, Request, SupportTicket, Category, PendingVerification, VerificationLog };
