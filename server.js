var LeapJS = require('.');
var Leap = require('leapjs');
var beacon = require('./src/beacon');
var express = require('express');

new Leap.Controller().use('leapdrone', { 
    controller: 'translational',
    onNewPosition: function(pos) {
        beacon.publish({
            event: 'position',
            data: pos
        });
    }
}).connect();

var app = express();
app.use(express.static(__dirname + '/demo'));
var listener = app.listen(process.env.PORT || 8081, function() {
    console.log("Web server listening on port %s", listener.address().port);
});