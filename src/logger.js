'use strict';

const { logToFile, dir } = require('../config').log;
const Logger = require('@zhangfuxing/logger');

const option = {
  rotate: true  // cut by day
};

if (logToFile) option.dir = dir;

const logger = new Logger(option);

module.exports = logger;