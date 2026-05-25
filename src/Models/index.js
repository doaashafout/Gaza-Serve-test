const User = require('./UserModel');
const Technician = require('./TechnicianModel');
const Request = require('./RequestModel');
const Rating = require('./RatingModel');
const SupportTicket = require('./SupportTicketModel');

// --- Relationships ---

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

module.exports = { User, Technician, Request, Rating, SupportTicket };
