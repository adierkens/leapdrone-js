'use strict';
var _ = require('lodash');
var helper = require('./helpers');
var moment = require('moment');
var beacon = require('./beacon');
var constants = require('./constants');

var defaultMotionOptions = {
  onNewPosition: function(){},
  onHandLost: function(side){},
  newPositionEventName: 'newPosition',
  lostHandEventName: 'handLost',
  rollingAverageCount: 5, // Set to 0 or false to not use the rollingAverage
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
    if (options.rollingAverageCount == 0) {
      options.rollingAverageCount = 1;
    }
    this.options = _.assign(defaultMotionOptions, options);
    this.controlStateMachine = new ControlSignalStateMachine();
    this.prevPositions = [];
    this.activeHands = {};
    var self = this;
    beacon.register(beacon.events.config, function(data) {
      console.log('Updating configuration');
      console.log(data.data);
      _.assign(self.options, data.data);
    });
  }

  rollingAverage() {
    if (this.prevPositions.length > this.options.rollingAverageCount) {
      this.prevPositions = _.drop(this.prevPositions, this.prevPositions.length - this.options.rollingAverageCount - 1);
    }
    return helper.average(this.prevPositions);
  }

  calculateNewPosition(hand) {
    var position = {};
    var self = this;
    _.each(constants.directions, function(dir) {
      position[dir] = helper[self.options.controller][dir](hand);
    });

    position.metaData = {
      controller: this.options.controller
    };

    return position;
  }

  onHand(hand, sender) {
    if (hand.type === "right") {
      // Right hand is the directional controller hand for the drone
      var newPosition = this.calculateNewPosition(hand);
      this.prevPositions.push(newPosition);
      var currentPosition = this.rollingAverage();
      currentPosition.metaData = newPosition.metaData;
      sender.emit(this.options.newPositionEventName, currentPosition);
      this.options.onNewPosition(currentPosition);
    } else {
      // Left hand is used for mode settings
      this.controlStateMachine.onHand(hand, sender);
    }
  }

  onFrame(frame, sender) {

    var newFrameHands = {};
    var self = this;

    _.each(frame.hands, function(hand) {
      newFrameHands[hand.id] = hand;
    });

    _.forIn(this.activeHands, function(hand, handID) {

      if (!newFrameHands[handID]) {
        sender.emit(self.options.lostHandEventName, hand.type);
        self.options.onHandLost(hand.type);

        if (hand.type === "right") {
          sender.emit(self.options.newPositionEventName, constants.defaultPosition);
          self.options.onNewPosition(constants.defaultPosition);
        }
      }

    });

    this.activeHands = newFrameHands;
  }

}

module.exports = function(options) {
  return new MotionController(options);
};
