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

class MotionController {

  constructor(options) {
    if (options.rollingAverageCount == 0) {
      options.rollingAverageCount = 1;
    }
    this.options = _.assign(defaultMotionOptions, options);
    this.prevPositions = [];
    this.activeHands = {};
    this.quadNumber = 0;
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
      currentPosition.quad = this.quadNumber;
      sender.emit(this.options.newPositionEventName, currentPosition);
      this.options.onNewPosition(currentPosition);
    } else {
      var quadNumber = helper.quadSelector(hand);
      if (quadNumber !== this.quadNumber) {
        log.info('Switched to control quad: ' + quadNumber);
        this.quadNumber = quadNumber;
      }
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
          var position = constants.defaultPosition;
          position.quad = self.quadNumber;
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
