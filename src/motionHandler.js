'use strict';
var _ = require('lodash');
var helper = require('./helpers');
var moment = require('moment');
var beacon = require('./beacon');
var constants = require('./constants');
var log = require('./log');

var defaultMotionOptions = {
  onNewPosition: function(){},
  onHandLost: function(side){},
  newPositionEventName: 'newPosition',
  lostHandEventName: 'handLost',
  rollingAverageCount: 1, // Set to 0 or false to not use the rollingAverage,
  sensitivity: {
    roll: 0.5,
    pitch: 0.5,
    yaw: 0.5,
    throttle: 0.5
  }
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
        log.info('Control Set');
      }
      this._controlSet = true;
    } else if (this._controlSet) {
      // We didn't see a controlSignal
      // Check if we've timed out
      if ((time() -  this._lastControlSeen) > this.options.signalTimeout) {
        this._controlSet = false;
        log.info('Control timed-out');
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
      log.info('Updating configuration: %j', data.data);
      _.assign(self.options, data.data);
    });
  }

  /**
   * Calculates the current rolling average
   * @returns {Object} - the current position
   */
  rollingAverage() {
    if (this.prevPositions.length > this.options.rollingAverageCount) {
      this.prevPositions = _.drop(this.prevPositions, this.prevPositions.length - this.options.rollingAverageCount - 1);
    }
    return helper.average(this.prevPositions);
  }

  /**
   * Calculates the new position given a hand object
   * @param hand - a Leap Hand instance
   * @returns {Object} - the new position
   */
  calculateNewPosition(hand) {
    var position = helper[this.options.controller](hand, this.options);
    position.metaData = {
      controller: this.options.controller,
      sensitivity: this.options.sensitivity
    };
    return position;
  }

  /**
   * The callback when a new frame with a hand is found
   * Calculates the current position/control scheme based on if the hand is left or right
   * @param hand - The hand that is found in frame
   * @param sender - A Leap Controller
   */
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

  /**
   * The callback when a new frame is found
   * Checks to see if we lost the right hand, if so, sets the position of the drone to the default one
   * @param frame - The frame that's found
   * @param sender - A Leap Controller
   */
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
