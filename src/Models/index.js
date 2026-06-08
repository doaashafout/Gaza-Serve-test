const User = require('./UserModel');
const Technician = require('./TechnicianModel');
const Request = require('./RequestModel');
const Rating = require('./RatingModel');
const SupportTicket = require('./SupportTicketModel');
const Category = require('./CategoryModel');
const Admin = require('./AdminModel');
const ActivityLog = require('./ActivityLogModel');

// User -> Request (1 to Many)
User.hasMany(Request, { foreignKey: 'client_id', as: 'requests' });
Request.belongsTo(User, { foreignKey: 'client_id', as: 'client' });

// Technician -> Request (1 to Many)
Technician.hasMany(Request, { foreignKey: 'tech_id', as: 'assignedRequests' });
Request.belongsTo(Technician, { foreignKey: 'tech_id', as: 'technician' });

// Request -> Rating (1 to 1)
Request.hasOne(Rating, { foreignKey: 'request_id', as: 'rating' });
Rating.belongsTo(Request, { foreignKey: 'request_id', as: 'request' });

// User -> SupportTicket (1 to Many)
User.hasMany(SupportTicket, { foreignKey: 'user_id', as: 'tickets' });
SupportTicket.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Category -> Technician (1 to Many)
Category.hasMany(Technician, { foreignKey: 'category', sourceKey: 'name_ar', as: 'technicians' });
Technician.belongsTo(Category, { foreignKey: 'category', targetKey: 'name_ar', as: 'categoryInfo' });

// Admin -> ActivityLog (1 to Many)
Admin.hasMany(ActivityLog, { foreignKey: 'admin_id', as: 'logs' });
ActivityLog.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

// Category -> Request (1 to Many)
Category.hasMany(Request, { foreignKey: 'extracted_category', sourceKey: 'name_ar', as: 'requestsByCategory' });

module.exports = { User, Technician, Request, Rating, SupportTicket, Category, Admin, ActivityLog };
