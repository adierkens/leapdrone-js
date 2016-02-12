'use strict';
var _ = require('lodash');
var Leap = require('leapjs');
var constants = require('./constants');
var fistThreshold = .2;
const log = require('./log');

/**
 * The boundaries of the effective range of the leap motion
 * Measured in mm, with [0,0,0] being the leap itself
 */
const LEAP_BOUNDARIES = {
  x: {
    min: -300,
    max: 300
  },
  y: {
    min: 50,
    max: 1000
  },
  z: {
    min: -300,
    max: 300
  }
};

/**
 * Takes the given angle and makes sure it's in the range of [-PI/2,PI/2]
 * @param angle
 */
function normalizeAngle(angle) {
  return Math.min(Math.PI/2, Math.max(-Math.PI/2, angle));
}

/**
 * The functions to calculate roll, pitch, yaw, and throttle using the banked hand motions
 */
const banked = {
  roll: function(hand, options) {
    var avgDeltaX = 0;
    var avgDeltaY = 0;

    var lastFinger;

    hand.fingers.forEach(function(finger) {
      if (finger.type === 0 || finger.type === 4) {
        return;
      }

      if (!lastFinger) {
        lastFinger = finger;
        return;
      }

      avgDeltaX += finger.dipPosition[0] - lastFinger.dipPosition[0];
      avgDeltaY += finger.dipPosition[1] - lastFinger.dipPosition[1];

      lastFinger = finger;
    });

    avgDeltaX = avgDeltaX/hand.fingers.length;
    avgDeltaY = avgDeltaY/hand.fingers.length;

    return normalizeAngle(-(2.5 * options.sensitivity.roll) * Math.atan(avgDeltaY/avgDeltaX));
  },
  pitch: function(hand, options) {
    var palmY = hand.palmPosition[1];
    var palmZ = hand.palmPosition[2];

    var avgAngle = 0;

    hand.fingers.forEach(function(finger) {
      if (finger.type === 0 || finger.type === 4) {
        return;
      }

      var deltaY = finger.dipPosition[1] - palmY;
      var deltaZ = finger.dipPosition[2] - palmZ;
      avgAngle += Math.atan(deltaY/deltaZ);
    });

    var angle = (2.5 * options.sensitivity.pitch) * (-avgAngle / hand.fingers.length);
    return normalizeAngle(angle);
  },
  yaw: function(hand, options) {
    var shouldCalc = true;
    var index = hand.indexFinger;

    _.each(hand.fingers, function(finger) {
      if (finger.extended && finger !== index) {
        shouldCalc = false;
      }
    });

    if (!shouldCalc || !index.extended) {
      return 0;
    }

    var proximalBone = index.proximal;
    var distalBone = index.distal;

    var zDiff = proximalBone.center()[0] - distalBone.center()[0];
    var angle = calculateAngleFromRange(zDiff * (2 * options.sensitivity.yaw), -40, 40);
    return angle;
  },
  throttle: function(hand) {
    var palmHeight = hand.palmPosition[1];
    return calculateAngleFromRange(palmHeight, LEAP_BOUNDARIES.y.min, LEAP_BOUNDARIES.y.max);
  }
};

/**
 * The functions to calculate roll, pitch, yaw, and throttle using the translational hand motions
 */
const translational = {
  roll: function(hand) {
    var palmX = hand.palmPosition[0];
    return calculateAngleFromRange(palmX, LEAP_BOUNDARIES.x.min, LEAP_BOUNDARIES.x.max);
  },
  pitch: function (hand) {
    var palmZ = hand.palmPosition[2];
    return calculateAngleFromRange(palmZ, LEAP_BOUNDARIES.z.min, LEAP_BOUNDARIES.z.max);
  },
  yaw: function(hand) {
    return 0;
  },
  throttle: banked.throttle
};

/**
 * A function to check if the given hand is making a fist
 * @param hand - Leap instance of a hand
 * @returns {boolean} - true if the hand is in a fist
 */
function isFist(hand) {
  var totalLength = 0;
  var palmPosition = hand.palmPosition;

  _.each(hand.fingers, function(finger) {
    if (finger.extended) {
      return false;
    }

    var fingerPos = finger.dipPosition;
    totalLength += Leap.vec3.dist(palmPosition, fingerPos);
  });

  return (totalLength/10.0) > fistThreshold;
}

/**
 * Computes the composite average of an array of positions
 * @param arr - An array of positions
 * @returns {object} - A dictionary of roll, pitch, yaw, and throttle positions reflecting the average
 */
function average(arr) {
  var sum = {};

  _.each(constants.directions, function(dir) {
    sum[dir] = 0;
  });

  for( var i = 0; i < arr.length; i++ ){
    _.each(constants.directions, function(dir) {
      sum[dir] += arr[i][dir];
    });
  }

  return _.mapValues(sum, function(tot) {
    return tot/arr.length;
  });
}

/**
 * Calculates the effective angle from [-PI/2,PI/2]
 * @param distance - the measurement
 * @param min - the minimum of the measurement range
 * @param max - the maximum of the measurement range
 * @returns {number} - angle in radians
 */
function calculateAngleFromRange(distance, min, max) {
  var distance = Math.max(Math.min(max, distance), min);
  var distancePercent = (distance - min) / (max - min);
  return (Math.PI * distancePercent) - (Math.PI / 2.0);
}

module.exports = {
  banked: function(hand, options) {
    var yaw = banked.yaw(hand, options);
    var throttle = banked.throttle(hand, options);
    var roll = 0;
    var pitch = 0;

    /**
     * If there's a yaw - ignore the roll and pitch of the hand
     */
    if (yaw > 0.001 && yaw > -0.001) {
      roll = banked.roll(hand, options);
      pitch = banked.pitch(hand, options);
    }

    return {
      roll: roll,
      pitch: pitch,
      yaw: yaw,
      throttle: throttle
    };
  },
  translational: function(hand) {
    return {
      roll: translational.roll(hand),
      pitch: translational.pitch(hand),
      yaw: translational.yaw(hand),
      throttle: translational.throttle(hand)
    };
  },
  isFist: isFist,
  average: average
};
