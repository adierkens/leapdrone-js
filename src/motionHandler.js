'use strict';
var _ = require('lodash');
var helper = require('./helpers');

var defaultOptions = {
    onNewPosition: function(pos){},
    newPositionEventName: 'newPosition'
};

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
            roll: helper.roll(hand),
            pitch: helper.pitch(hand),
            yaw: helper.yaw(hand)
        }; 
    }

}

module.exports = function(options) {
    return options.bankedController? new BankedMotionController(options) : new TranslationalMotionController(options);
}