'use strict';
var _ = require('lodash');
var I2CBus = require('i2c-bus');
var PCA9685Driver = require('pca9685').Pca9685Driver;
var beacon = require('./beacon');

const PCAOptions = {
    i2c: I2CBus.openSync(0),
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
    yaw: 2,
};

var pwm = new PCA9685Driver(PCAOptions, function() {
    console.log("PWM Initialization done.");
    
    _.each(['roll', 'pitch', 'yaw'], function(direction) {
        pwm.setDutyCycle(PWM_CHANNEL_MAP[direction], INITIAL_DUTY_CYCLE[direction]);
    });
});

function dutyCycleFromAngle(angle) {
    var anglePercent = (angle + (Math.PI/2)) / Math.PI;
    if (anglePercent < 0.001) {
        anglePercent = 0.001;
    }
    return anglePercent;
};

module.exports = {

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
