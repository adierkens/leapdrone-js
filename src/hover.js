'use strict';
var beacon = require('./beacon');
var log = require('./log');
var helpers = require('./helpers');
var drone = require('./drone');

var shouldControlQuad = false;
var desiredPosition = null;
var integral = 0;
var lastError = {
  x: 0,
  y: 0,
  z: 0
};

const P = 0;
const I = 0;
const D = 0;

var lastQuadPosition = {
  x: 0,
  y: 0,
  z: 0
};

beacon.register(beacon.events.position, function(event) {
  log.info(event);
  if (!shouldControlQuad) {
    return;
  }

  if (!desiredPosition) {
    desiredPosition = event.data;
    return;
  }

  // Calculate the PID values for the controller

  var error = helpers.positionDifference(desiredPosition, event.data);
  var proportional = error;
  var derivative = helpers.positionDifference(error, lastError);
  integral = helpers.positionSum(integral, lastError);
  lastError = error;

  var throttle = (P * proportional.y) + (I * integral.y) + (D * derivative.y);

  var newPosition = drone.currentPosition();
  newPosition.throttle += throttle;

  log.info('Throttle: %s', newPosition.throttle);

  // drone.update(newPosition);
});

var startHover = function() {
  shouldControlQuad = true;
};

var resetParams = function() {
  shouldControlQuad = false;
  lastQuadPosition = {
    x: 0,
    y: 0,
    z: 0
  };
  desiredPosition = null;
  integral = 0;
  lastError = {
    x: 0,
    y: 0,
    z: 0
  };
};

var endHover = function() {
  resetParams();
};

module.exports = {
  start: startHover,
  end: endHover
};
