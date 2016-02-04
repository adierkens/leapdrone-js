'use strict';
var _ = require('lodash');
var beacon = require('./beacon');
var Logger = require('js-logger');

var I2CBus, PCA9685Driver, pwm;

var PCAOptions = {
  address: 0x40,
  frequency: 1200,
  debug: false
};

const INITIAL_DUTY_CYCLE = {
  roll: 0.5,
  pitch: 0.5,
  yaw: 0.001
};

const PWM_CHANNEL_MAP = {
  roll: 0,
  pitch: 1,
  yaw: 2
};

try {
  I2CBus = require('i2c-bus');
  PCA9685Driver = require('pca9685').Pca9685Driver;
  PCAOptions.i2c = I2CBus.openSync(0);

  pwm = new PCA9685Driver(PCAOptions, function() {
    Logger.info("PWM Initialization done.");

    _.each(['roll', 'pitch', 'yaw'], function(direction) {
      pwm.setDutyCycle(PWM_CHANNEL_MAP[direction], INITIAL_DUTY_CYCLE[direction]);
    });
  });

} catch (e) {
  Logger.warn("PWM Drivers not supported");
}

function dutyCycleFromAngle(angle) {
  var anglePercent = (angle + (Math.PI/2)) / Math.PI;
  if (anglePercent < 0.001) {
    anglePercent = 0.001;
  }
  return anglePercent;
};


var droneControl = {

  /**
   * Takes a position update and sends the appropriate GPIO signal
   */
  update: function(position_update) {
    _.each(['roll', 'pitch', 'yaw'], function(direction) {
      var dutyCycle = dutyCycleFromAngle(position_update[direction]);
      pwm.setDutyCycle(PWM_CHANNEL_MAP[direction], dutyCycle);
    });
  }
};

if (PCA9685Driver) {
  module.exports = droneControl;
} else {
  module.exports = {
    update: function (position_update) {}
  };
}
