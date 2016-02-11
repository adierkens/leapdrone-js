var LeapJS = require('.');
var Leap = require('leapjs');
var beacon = require('./src/beacon');
var express = require('express');
var drone = require('./src/drone');
var log = require('./src/log');

new Leap.Controller().use('leapdrone', { 
    controller: 'banked',
    onNewPosition: function(pos) {
        beacon.publish({
            event: 'position',
            data: pos
        });

        drone.update(pos);
    }
}).connect();

var app = express();
app.use(express.static(__dirname + '/demo'));
var listener = app.listen(process.env.PORT || 8081, function() {
    log.info("Web server listening on port %s", listener.address().port);
});
