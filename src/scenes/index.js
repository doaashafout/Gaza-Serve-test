const { Scenes } = require('telegraf');
const techRegistrationScene = require('./techRegistrationScene');

const stage = new Scenes.Stage([techRegistrationScene]);

module.exports = stage;
