'use strict';
var _ = require('lodash');
var WebSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function(request, response) {
    response.writeHead(500, {"Content-Type": "text/plain"});
    response.write(err + "\n");
    response.end();
});

server.listen(8080, function() {
    console.log('Beaconing Server is listening on port 8080');
});

var wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

var peerList = [];

const EVENT_NAMES = {
    config: 'config'
};

var registrations = {

};

wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);
    peerList.push(connection);

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            var message = JSON.parse(message.utf8Data);
            var event_name = message.event;

            if (!EVENT_NAMES[event_name]) {
                console.log('Unknown event received');
                console.log(message);
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

function publish(data) {
    _.each(peerList, function(peerConnection) {
        if (peerConnection.connected) {
            peerConnection.sendUTF(JSON.stringify(data));
        }
    });
}

function register(event_name, callback) {
    if (!EVENT_NAMES[event_name]) {
        console.log('Unknown event: ' + event_name);
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