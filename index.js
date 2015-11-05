'use strict';
var Leap = require('leapjs');
var _ = require('lodash');

var defaultOptions = {
    onNewPosition: function(pos){},
    newPositionEventName: 'newPosition'
};


function calculateRoll(hand) {
    var avgDeltaX = 0;
    var avgDeltaY = 0;

    var lastFinger;
    
    hand.fingers.forEach(function(finger) {
        if (finger.type == 0 || finger.type == 4) {
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
        if (finger.type == 0 || finger.type == 4) {
            return;
        }

        var deltaY = finger.dipPosition[1] - palmY;
        var deltaZ = finger.dipPosition[2] - palmZ;
        avgAngle += Math.atan(deltaY/deltaZ);
    });

    return -avgAngle / hand.fingers.length;
}

function calculateYaw(hand) {
    return 0;
}

class MotionController {
    constructor(options) {
        this.options = _.assign(defaultOptions, options);
    }

    onHand(hand, sender) {
        if (hand.type == "right") {
            var newPosition = this.calculateNewPosition(hand);    
            sender.emit(this.options.newPositionEventName, newPosition);
            this.options.onNewPosition(newPosition);
        } 
    }
 
}

class TranslationalMotionController extends MotionController {
}

class BankedMotionController extends MotionController {
    
    calculateNewPosition(hand) {
        return {
            roll: calculateRoll(hand),
            pitch: calculatePitch(hand),
            yaw: calculateYaw(hand)
        }; 
    }

}


Leap.plugin('leapdrone', function(options) {

    var leapDrone = options.bankedController? new BankedMotionController(options) : new TranslationalMotionController(options);

    return {
        hand: function(hand) {
            leapDrone.onHand(hand, this);
        }
    };
});
