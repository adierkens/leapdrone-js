var LeapJS = require('.');
var Leap = require('leapjs');
var beacon = require('./src/beacon');

new Leap.Controller().use('leapdrone', { 
    bankedController: true, 
    onNewPosition: function(pos) {
        console.log(pos);
        beacon({
            event: 'position',
            data: pos
        });
    }
}).connect();
