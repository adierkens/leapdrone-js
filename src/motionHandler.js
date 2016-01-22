'use strict';
var _ = require('lodash');
var helper = require('./helpers');
var moment = require('moment');

var defaultMotionOptions = {
    onNewPosition: function(){},
    newPositionEventName: 'newPosition'
};

var defaultControlOptions = {
    onNewControl: function(){},
    controlSetEventName: 'controlSet',
    signalHoldTime: 3,
    signalTimeout: 5,
    isSetSignal: helper.isFist
};

function time() {
    return moment().unix();
}

class ControlSignalStateMachine {
    constructor(options) {         
        this.options = _.assign(defaultControlOptions, options);
        this._controlSet = false;
        this._controlStartTime = 0;
        this._lastControlSeen = 0;
    }

    _checkControlSet(hand) {
        if (this.options.isSetSignal(hand)) {
            var curTime = time();
            if (!this._controlStartTime) {
                this._controlStartTime = curTime;
            }
            this._lastControlSeen = curTime;
        } else {
            this._controlStartTime = 0;
        }


        if (this._controlStartTime && (this._lastControlSeen - this._controlStartTime) > this.options.signalHoldTime) {
            if (!this._controlSet) {
                console.log('control set');
            }
            this._controlSet = true;
        } else if (this._controlSet) {
            // We didn't see a controlSignal
            // Check if we've timed out
            if ((time() -  this._lastControlSeen) > this.options.signalTimeout) {
                this._controlSet = false;
                console.log('control timed-out');
            }   
        }
        return this._controlSet;
    }

    onHand(hand, sender) {
        if (hand.type === "right") {
            // Ignore any right hand signals for now
            return;
        }

        if (this._checkControlSet(hand)) {
            sender.emit(this.options.controlSetEventName);
        }
    }
}

class MotionController {
    constructor(options) {
        this.options = _.assign(defaultMotionOptions, options);
        this.controlStateMachine = new ControlSignalStateMachine();
    }

    onHand(hand, sender) {
        if (hand.type === "right") {
            // Right hand is the directional controller hand for the drone
            var newPosition = this.calculateNewPosition(hand);    
            sender.emit(this.options.newPositionEventName, newPosition);
            this.options.onNewPosition(newPosition);
        } else {
            // Left hand is used for mode settings
            this.controlStateMachine.onHand(hand, sender);
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
};
