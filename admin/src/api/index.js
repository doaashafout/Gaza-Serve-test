import axios from 'axios';

const api = axios.create({ baseURL: '/api/admin' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/';
    }
    return Promise.reject(err);
  }
);

// Users
export const getUsers = (params) => api.get('/users', { params });
export const blockUser = (id) => api.post(`/users/${id}/block`);
export const unblockUser = (id) => api.post(`/users/${id}/unblock`);
export const getUserRequests = (id) => api.get(`/users/${id}/requests`);

// Technicians
export const getTechnicians = (params) => api.get('/technicians', { params });
export const getTechnician = (id) => api.get(`/technicians/${id}`);
export const createTechnician = (data) => api.post('/technicians', data);
export const updateTechnician = (id, data) => api.put(`/technicians/${id}`, data);
export const deleteTechnician = (id) => api.delete(`/technicians/${id}`);
export const approveTechnician = (id) => api.post(`/technicians/${id}/approve`);
export const rejectTechnician = (id) => api.post(`/technicians/${id}/reject`);

// Requests
export const getRequests = (params) => api.get('/requests', { params });
export const getRequest = (id) => api.get(`/requests/${id}`);
export const getAvailableTechs = (id) => api.get(`/requests/${id}/available-techs`);
export const reassignRequest = (id, techId) => api.post(`/requests/${id}/reassign`, { technician_id: techId });

// Categories
export const getCategories = () => api.get('/categories');
export const createCategory = (data) => api.post('/categories', data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// Tickets
export const getTickets = (params) => api.get('/tickets', { params });
export const replyTicket = (id, message) => api.post(`/tickets/${id}/reply`, { message });

// Notifications
export const sendBroadcast = (data) => api.post('/notifications/broadcast', data);

// Logs
export const getLogs = (params) => api.get('/logs', { params });

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);

// Admins
export const getAdmins = () => api.get('/admins');
export const createAdmin = (data) => api.post('/admins', data);
export const updateAdmin = (id, data) => api.put(`/admins/${id}`, data);
export const deleteAdmin = (id) => api.delete(`/admins/${id}`);

// Dashboard
export const getStats = () => api.get('/stats');

export default api;
