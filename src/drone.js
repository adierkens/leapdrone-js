'use strict';

var PWMDriver;
try {
  PWMDriver = require('adafruit-i2c-pwm-driver');
  var pwm = new PWMDriver(0x40, '/dev/i2c-7', true);
} catch (e) {
    console.log("No I2C driver available");
}


module.exports = {

    /**
     * Takes a position update and sends the appropriate GPIO signal
     */
    update: function(position_update) {

    }
};