'use strict';
var beacon = require('./beacon');
var log = require('./log');
var helpers = require('./helpers');
var drone = require('./drone');
var _ = require('lodash');

var onNewPosition = function() {};
var shouldControlQuad = false;
var desiredPosition = null;
var integral = 0;
var lastError = {
  x: 0,
  y: 0,
  z: 0
};

var control = {
  P: 0,
  I: 0,
  D: 0
};

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

  var throttle = (control.P * proportional.y) + (control.I * integral.y) + (control.D * derivative.y);

  var newPosition = drone.currentPosition();
  newPosition.throttle += throttle;

  if (!newPosition.metaData) {
    newPosition.metaData = {};
  }

  newPosition.metaData.pid = control;

  log.info('Throttle: %s', newPosition.throttle);

  onNewPosition(newPosition);
});

var startHover = function(callback) {
  onNewPosition = callback || function() {};
  shouldControlQuad = true;
};

beacon.register(beacon.events.config, function(data) {
  if (data.data.pid) {
    _.assign(control, data.data.pid);
  }
});

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
