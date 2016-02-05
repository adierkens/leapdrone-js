[![Build Status](https://travis-ci.org/adierkens/leapdrone-js.svg?branch=master)](https://travis-ci.org/adierkens/leapdrone-js)
# leapdrone
> A javascript version of the leapdrone project

## Installation

``` npm install ```

You'll also need to have the LeapMotion drivers installed on your system.

## Running

``` npm start ```

Then you can naviage to ```localhost:8081``` which gives a demo of the calculation of the quadcopter's position in real time.

## Overview

The leapdrone controller is structed as a plugin to the Leap Motion Controller. 
Simply request the 'leapdrone' plugin to use it.

```
new Leap.Controller().use('leapdrone', { 
    controller: 'translational',
    onNewPosition: function(pos) {
        beacon.publish({
            event: 'position',
            data: pos
        });
    }
}).connect();
```

### Options

#### options.controller
Type: `String`

The type of motion control to use: `banked` or `translational`

#### options.onNewPosition
Type: `Function`

The callback when a new drone position is calculated. The parameter is an object: 
```
{
    roll: 0,
    pitch: 0,
    yaw: 0,
    metaData: {
        controller: 'banked'
    }
}
```

`roll`, `pitch`, and `yaw` are all doubles between [ -PI/2, PI/2 ] representing the X, Y, Z angles the drone should take.

#### options.rollingAverageCount
Type: `Integer`
Default value: `20`

In order to smooth out the position calculations, a rolling average is used in the calculations. By default, the current position will be the average of the last 20 frames.  

To disable the rolling average, set this to `false`, `0`, or `1`
 

# TODO
 - ~~Style the demo page~~ 
 - Make demo page responsive
 - Make graph move smooth
 - Debounce beaconing - sending batches of requests 
 - ~~Architect the backend for sending the I2C calls~~
 - ~~Handle the syncing/registration for connecting to a drone through RF~~
 - Add control signals
 - Add multiple drone support in the demo page

