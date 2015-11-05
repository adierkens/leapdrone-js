var LeapJS = require('.');
var Leap = require('leapjs');

new Leap.Controller().use('leapdrone', { 
    bankedController: true, 
    onNewPosition: function(pos) {
        console.log(pos);
    }
}).connect()
