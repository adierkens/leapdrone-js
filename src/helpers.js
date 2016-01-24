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

function calculateYaw(hand) {

    // We need to map the hand's height to the range [ -PI/2, PI/2 ] to match the other axises
    // The palm position is in mm and is the height over the sensor. We'll cap it at [ 0 - 300 ]
    // as 150 is about the center of where you're hand normally rests

    var palmHeight = hand.palmPosition[1];

    // make sure it's within range
    palmHeight = Math.min(palmHeight, 300);

    var palmHeightPercent = palmHeight / 300.0;

    return (Math.PI * palmHeightPercent) - (Math.PI / 2.0);
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

module.exports = {
    roll: calculateRoll,
    pitch: calculatePitch,
    yaw: calculateYaw,
    isFist: isFist,
    average: average
};
