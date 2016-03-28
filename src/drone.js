'use strict';
var _ = require('lodash');
var beacon = require('./beacon');
var Logger = require('./log');
var constants = require('./constants');

var I2CBus, PCA9685Driver, pwm;

var PCAOptions = {
  address: 0x40,
  frequency: 1200,
  debug: false
};

const INITIAL_DUTY_CYCLE = {
  roll: dutyCycleFromAngle(constants.defaultPosition.roll),
  pitch: dutyCycleFromAngle(constants.defaultPosition.pitch),
  yaw: dutyCycleFromAngle(constants.defaultPosition.yaw),
  throttle: dutyCycleFromAngle(constants.defaultPosition.throttle)
};

const PWM_CHANNEL_MAP = {
  roll: 0,
  pitch: 1,
  throttle: 2,
  yaw: 3
};

var lastPositionUpdate;

/**
 * The time (ms) to wait between sync transitions
 */
const QUAD_SYNC_DELAY = 2000; //

/**
 * NOTE: The PWM controller doesn't like really low dutyCycle numbers
 * Using pwm.setDutyCycle() with a number below this threshold will actually set the channel to be HIGH.
 * To combat this, anything at or below this number gets the channel explicitly set to 0 using setPulseRange(). See zeroChannel()
 */
const ZERO_THRESHOLD = 0.001;

/**
 * Some dev machines (i.e. My MacBook) doesn't have a valid I2C bus
 * Gracefully handle when we can't control the PWM board so development isn't blocked.
 */
try {
  I2CBus = require('i2c-bus');
  PCA9685Driver = require('pca9685').Pca9685Driver;
  PCAOptions.i2c = I2CBus.openSync(getI2CBus());

  pwm = new PCA9685Driver(PCAOptions, function() {
    Logger.info("PWM Initialization done.");

    /**
     * Set all the initial PWM signals
     */
    _.each([0, 1, 2, 3], function(quadNumber) { 
      _.forIn(INITIAL_DUTY_CYCLE, function(dutyCycle, direction) {
        setDutyCycle(normalizedPin(quadNumber, PWM_CHANNEL_MAP[direction]), dutyCycle);
      });
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
  pwm.setPulseRange(channel, 0, 0);
}

/**
 * Sets the duty cycle of a channel.
 * Correctly handles the oddities with dutyCycle numbers near 0
 * @param channel - The channel to set the dutyCycle on
 * @param dutyCycle - The dutyCycle to set in the range of [0,1]
 */
function setDutyCycle(channel, dutyCycle) {
  if (dutyCycle <= ZERO_THRESHOLD) {
    zeroChannel(channel);
  } else {
    pwm.setDutyCycle(channel, dutyCycle);
  }
}

function normalizedPin(quadNumber, pin) {
    
    if (arguments.length === 1)  {
        pin = quadNumber;
        quadNumber = 0;
    }

    return (quadNumber * 4) + pin;
}

/**
 * Syncs the drone with the controller
 * The throttle needs to go from 0-3.3v-0
 * All other axises are 1.65
 */
function sync(quadNum) {
  quadNum = quadNum || 0;
  if (!pwm) {
    Logger.warn('PWM not supported. Ignoring sync..');
    return;
  }

  /**
   * Set the initial conditions - 0 throttle, everything else in the middle
   */
  _.forIn(PWM_CHANNEL_MAP, function(channel, direction) {
    if (direction === 'throttle') {
      zeroChannel(normalizedPin(quadNum, channel));
    } else {
      pwm.setDutyCycle(normalizedPin(quadNum, channel), 0.5);
    }
  });

  /**
   * After QUAD_SYNC_DELAY ms, set the throttle to 100%
   */
  setTimeout(function() {
    pwm.setDutyCycle(normalizedPin(quadNum, PWM_CHANNEL_MAP.throttle), 1);

    /**
     * After another QUAD_SYNC_DELAY ms, set the throttle back down to 0
     */
    setTimeout(function() {
      zeroChannel(normalizedPin(quadNum, PWM_CHANNEL_MAP.throttle));
      Logger.info('Finished Drone Sync');
    }, QUAD_SYNC_DELAY);
  }, QUAD_SYNC_DELAY);
}

/**
 * Handle the sync event for a drone
 */
beacon.register(beacon.events.droneSync, function(ev) {
  var quadNum = ev.data.quad || 0;
  Logger.info('Starting Drone Sync for quad: ' + quadNum);
  sync(quadNum);
});

/**
 * Calculate the duty cycle, given an angle from [-PI/2, PI/2]
 * @param angle - the angle in radians
 * @returns {number} - the duty cycle. Range from [0-1]
 */
function dutyCycleFromAngle(angle) {
  return (angle + (Math.PI/2)) / Math.PI;
};

var droneControl = {

  /**
   * Takes a position update and sends the appropriate GPIO signal
   */
  update: function(position_update) {
    position_update.quad = position_update.quad || 0;
    _.forIn(PWM_CHANNEL_MAP, function(channel, direction) {
      var dutyCycle = dutyCycleFromAngle(position_update[direction]);
      setDutyCycle(normalizedPin(position_update.quad, channel), dutyCycle);
    });
    lastPositionUpdate = position_update;
  },

  currentPosition: function() {
    return lastPositionUpdate;
  }

};

/**
 * If we don't have a PWM controller, use a dummy drone controller
 */
if (PCA9685Driver) {
  module.exports = droneControl;
} else {
  module.exports = {
    update: function (position_update) {}
  };
}

/**
 * Zero all of the channels when we're done
 */
process.on('SIGTERM', function() {
  _.forIn(PWM_CHANNEL_MAP, function(channel, direction) {
    zeroChannel(channel);
  });
});
