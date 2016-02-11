'use strict';
var winston = require('winston');
const moment = require('moment');

const timestamp = function() {
  return moment().format();
}; 

const formatter = function(options) {
  return timestamp() + ' ' + 
         options.level.toUpperCase() + ' ' + 
         (undefined !== options.message ? options.message : '') + 
         (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
};

const colors = {
  debug: 'blue',
  info: 'pink',
  warn: 'yellow',
  error: 'red'
};

winston.addColors(colors);

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      colorize: true,
      formatter: formatter
    }),
    new (winston.transports.File)({
      formatter: formatter,
      colorize: true,
      filename: 'leapdrone-js.log',
      level: 'debug'
    })
  ],
});

module.exports = logger;
