'use strict';
var _ = require('lodash');
var WebSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function(request, response) {
    response.writeHead(404);
    response.end();
});

server.listen(8080, function() {
    console.log('Server is listening on port 8080');
});

var wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

var peerList = [];

wsServer.on('request', function(request) {
    var connection = request.accept(null, request.origin);
    peerList.push(connection);

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Got message ' + message.utf8Data);
            connection.sendUTF(message.utf8Data);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log('Peer ' + connection.remoteAddress + ' disconnected');
        _.remove(peerList, connection);
    });
});

function beacon(data) {
    _.each(peerList, function(peerConnection) {
        if (peerConnection.connected) {
            peerConnection.sendUTF(JSON.stringify(data));
        }
    });
}

module.exports = function(data) {
    console.log('Beaconing Data:');
    console.log(data);
    beacon(data);
};