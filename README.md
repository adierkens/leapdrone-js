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
    bankedController: true, 
    onNewPosition: function(pos) {
        beacon({
            event: 'position',
            data: pos
        });
    }
}).connect();
```



