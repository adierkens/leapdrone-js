'use strict';
var _ = require('lodash');
var helper = require('./helpers');
var moment = require('moment');

var defaultMotionOptions = {
    onNewPosition: function(){},
    newPositionEventName: 'newPosition',
    rollingAverageCount: 20, // Set to 0 or false to not use the rollingAverage
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

function calculateBankedPosition(hand) {
    return {
        roll: helper.roll(hand),
        pitch: helper.pitch(hand),
        yaw: helper.yaw(hand)
    };
}

function calculateTranslationalPosition(hand) {
    return {
        roll: 0,
        pitch: 0,
        yaw: 0
    }
}

class MotionController {
    constructor(options) {
        if (options.rollingAverageCount == 0) {
            options.rollingAverageCount = 1;
        }
        this.options = _.assign(defaultMotionOptions, options);
        this.controlStateMachine = new ControlSignalStateMachine();
        this.prevPositions = [];
    }

    rollingAverage() {
        if (this.prevPositions.length > this.options.rollingAverageCount) {
            this.prevPositions = _.drop(this.prevPositions, this.prevPositions.length - this.options.rollingAverageCount - 1);
        }
        return helper.average(this.prevPositions);
    }

    calculateNewPosition(hand) {
        if (this.options.controller === 'banked') {
            return calculateBankedPosition(hand);
        }
        return calculateTranslationalPosition(hand);
    }

    onHand(hand, sender) {
        if (hand.type === "right") {
            // Right hand is the directional controller hand for the drone
            var newPosition = this.calculateNewPosition(hand);
            this.prevPositions.push(newPosition);
            var currentPosition = this.rollingAverage();
            sender.emit(this.options.newPositionEventName, currentPosition);
            this.options.onNewPosition(currentPosition);
        } else {
            // Left hand is used for mode settings
            this.controlStateMachine.onHand(hand, sender);
        }
    }
 
}

module.exports = function(options) {
    return new MotionController(options);
};
