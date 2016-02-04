'use strict';
var _ = require('lodash');
var Leap = require('leapjs');

var fistThreshold = .2;

const LEAP_BOUNDARIES = {
  x: {
    min: -300,
    max: 300
  },
  y: {
    min: 50,
    max: 600
  },
  z: {
    min: -300,
    max: 300
  }
};

function calculateBankedRoll(hand) {
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

  return -Math.atan(avgDeltaY/avgDeltaX);
}

function calculateBankedPitch(hand) {
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

  return -avgAngle / hand.fingers.length;
}

function calculateBankedYaw(hand) {

  // We need to map the hand's height to the range [ -PI/2, PI/2 ] to match the other axises
  // The palm position is in mm and is the height over the sensor. We'll cap it at [ 50 - 600 ]
  // as 300 is about the center of where you're hand normally rests
  var palmHeight = hand.palmPosition[1];
  return calculateAngleFromRange(palmHeight, LEAP_BOUNDARIES.y.min, LEAP_BOUNDARIES.y.max);
}

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

function average(arr) {
  var sum = {
    roll: 0,
    pitch: 0,
    yaw: 0
  };
  for( var i = 0; i < arr.length; i++ ){
    sum.roll += arr[i].roll;
    sum.pitch += arr[i].pitch;
    sum.yaw += arr[i].yaw;
  }

  return {
    roll: sum.roll/arr.length,
    pitch: sum.pitch/arr.length,
    yaw: sum.yaw/arr.length
  };
}

function calculateAngleFromRange(distance, min, max) {
  var distance = Math.max(Math.min(max, distance), min);
  var distancePercent = (distance - min) / (max - min);
  return (Math.PI * distancePercent) - (Math.PI / 2.0);
}

function calculateTranslationalRoll(hand) {
  var palmX = hand.palmPosition[0];
  return calculateAngleFromRange(palmX, LEAP_BOUNDARIES.x.min, LEAP_BOUNDARIES.x.max);
}

function calculateTranslationalPitch(hand) {
  var palmZ = hand.palmPosition[2];
  return calculateAngleFromRange(palmZ, LEAP_BOUNDARIES.z.min, LEAP_BOUNDARIES.z.max);
}

function calculateTranslationalYaw(hand) {
  return calculateBankedYaw(hand);
}

module.exports = {
  banked: {
    roll: calculateBankedRoll,
    pitch: calculateBankedPitch,
    yaw: calculateBankedYaw
  },
  translational: {
    roll: calculateTranslationalRoll,
    pitch: calculateTranslationalPitch,
    yaw: calculateTranslationalYaw
  },
  isFist: isFist,
  average: average
};
