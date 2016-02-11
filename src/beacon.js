'use strict';
var _ = require('lodash');
var WebSocketServer = require('websocket').server;
var http = require('http');
const log = require('./log');

var server = http.createServer(function(request, response) {
  response.writeHead(500, {"Content-Type": "text/plain"});
  response.write(err + "\n");
  response.end();
});

server.listen(8080, function() {
  log.info('Beaconing Server is listening on port 8080');
});

var wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

/**
 * A list of connected peers on the web-socket
 */
var peerList = [];

const EVENT_NAMES = {
  config: 'config',
  droneSync: 'drone-sync'
};

/**
 * A mapping of event names to the callbacks registered to listen for them.
 */
var registrations = {};

wsServer.on('request', function(request) {
  var connection = request.accept(null, request.origin);
  peerList.push(connection);

  /**
   * Every time we get a message, parse it, and check to see if it's for an event that we care about
   */
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      var message = JSON.parse(message.utf8Data);
      var event_name = message.event;

      if (_.values(EVENT_NAMES).indexOf(event_name) === -1) {
        log.warn('Unknown event received %j', message);
      } else {
        if (registrations[event_name]) {
          _.each(registrations[event_name], function(callback) {
            callback(message);
          });
        }
      }
    }
  });
  connection.on('close', function(reasonCode, description) {
    _.remove(peerList, connection);
  });
});

/**
 * Publish the given event to the network
 * @param data - The event to publish
 */
function publish(data) {
  _.each(peerList, function(peerConnection) {
    if (peerConnection.connected) {
      peerConnection.sendUTF(JSON.stringify(data));
    }
  });
}

/**
 * Register a listener for a specific event type
 * @param event_name - The event to listen for. One of EVENT_NAMES
 * @param callback - a function that get's called with the event data when one is published.
 */
function register(event_name, callback) {
  if (_.values(EVENT_NAMES).indexOf(event_name) === -1) {
    log.warn('Unknown event: %s', event_name);

  }

  if (!registrations[event_name]) {
    registrations[event_name] = [callback];
  } else {
    registrations.push(callback);
  }
}

module.exports = {
  publish: publish,
  register: register,
  events: EVENT_NAMES
};
