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

const QUAD_SYNC_DELAY = 1000; // The time (ms) to wait between sync transitions

try {
  I2CBus = require('i2c-bus');
  PCA9685Driver = require('pca9685').Pca9685Driver;
  PCAOptions.i2c = I2CBus.openSync(getI2CBus());

  pwm = new PCA9685Driver(PCAOptions, function() {
    Logger.info("PWM Initialization done.");

    _.forIn(INITIAL_DUTY_CYCLE, function(dutyCycle, direction) {
      pwm.setDutyCycle(PWM_CHANNEL_MAP[direction], dutyCycle);
    });
  });

} catch (e) {
  Logger.warn("PWM Drivers not supported");
}

/**
 * Finds the I2C bus number the PWM Board is attached to.
 *
 * @returns {number} Equivalent to /dev/i2c-X
 */
function getI2CBus() {
  return 0;
}

/**
 *
 * @param channel
 */
function zeroChannel(channel) {
  pwm.setDutyCycle(channel, 0.001);
}

/**
 * Syncs the drone with the controller
 * The throttle needs to go from 0-3.3v-0
 * All other axises are 1.65
 */
function sync() {
  if (!pwm) {
    Logger.warn('PWM not supported. Ignoring sync..');
    return;
  }
  _.forIn(PWM_CHANNEL_MAP, function(channel, direction) {
    if (direction === 'yaw') {
      zeroChannel(channel);
    } else {
      pwm.setDutyCycle(channel, 0.5);
    }
  });

  setTimeout(function() {
    pwm.setDutyCycle(PWM_CHANNEL_MAP.yaw, 1);
    setTimeout(function() {
      zeroChannel(PWM_CHANNEL_MAP.yaw);
    }, QUAD_SYNC_DELAY);
  }, QUAD_SYNC_DELAY);
}

// Handle the sync event for a drone
beacon.register(beacon.events.droneSync, function(ev) {
  Logger.info('Starting Drone Sync');
  sync();
});


function dutyCycleFromAngle(angle) {
  return (angle + (Math.PI/2)) / Math.PI;
};

var droneControl = {

  /**
   * Takes a position update and sends the appropriate GPIO signal
   */
  update: function(position_update) {
    _.forIn(PWM_CHANNEL_MAP, function(channel, direction) {
      var dutyCycle = dutyCycleFromAngle(position_update[direction]);
      if (dutyCycle <= 0.001 ) {
        zeroChannel(channel);
      } else {
        pwm.setDutyCycle(channel, dutyCycle);
      }
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
