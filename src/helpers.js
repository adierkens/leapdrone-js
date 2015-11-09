'use strict';
var _ = require('lodash');
var Leap = require('leapjs');

var fistThreshold = .2;

function calculateRoll(hand) {
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

function calculatePitch(hand) {
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

function calculateYaw() {
    return 0;
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

module.exports = {
    roll: calculateRoll,
    pitch: calculatePitch,
    yaw: calculateYaw,
    isFist: isFist
};
