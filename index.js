'use strict';
var Leap = require('leapjs');
var motionHandler = require('./src/motionHandler');

Leap.plugin('leapdrone', function(options) {

    var leapDrone = motionHandler(options);

    return {
        hand: function(hand) {
            leapDrone.onHand(hand, this);
        },
        frame: function(frame) {
            leapDrone.onFrame(frame, this);
        }
    };
});
