var io = require('socket.io-client');
var fs = require('fs');
var serverUrl = 'http://localhost:4131';
var conn = io.connect(serverUrl);
var secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';
var util = require('util');
var idDeviceCnt = 0;
var me = {};

conn.on('initWorker', function (data) {
    console.log('init', util.inspect(data));

    me = data;
    fs.writeFile('./meinfo.json', JSON.stringify(data), function (err) {
        if(err) throw err;

        console.log('created meinfo.json');
    })
});

conn.on('change', function (data) {
   console.log('change', util.inspect(data));
    var device;
    for(var i = 0, il = devices.length; i < il; i++) {
        if(devices[i].id === data.id) {
            device = devices[i];
            break;
        }
    }
    if(device)
        device.toggle(data.state, function (x, d) {
            //if(d.isVisible)
                conn.emit('change', {id: d.id, state: d.state});
        });
    else
        console.log("can't find device for id ", data.id);
});

var Device = function (pin, args) {
    if(!pin || typeof pin !== 'string')
        return null;

    var self = this;

    args = args || {};

    self.id = idDeviceCnt++;
    self.actionType = args.actionType;
    self.type = args.type;
    self.pin = pin;
    self.name = args.name || 'untitled';
    self.state = args.state;
    self.controls = args.controls;
    self.freq = args.freq || 5;
    self.isVisible = args.isVisible || false;

    self.switchCheck = function () {
        console.log('switch check');
//        b.digitalRead(self.pin, function (x) {
//            var curState = x.value;
//            if(curState < self.state) {
//                self.toggle();
//            }
//            self.state = curState;
//        });
    };

    self.sensorCheck = function () {
        console.log('sensor check');
//        if(analogPins.indexOf(self.pin) > -1) {
//            b.analogRead(self.pin, function (x) {
//                var curState = x.value;
//                //console.log(curState);
//                self.state = curState;
//            });
//        } else {
//            b.digitalRead(self.pin, function (x) {
//                var curState = x.value;
//                if(curState < self.state) {
//                    self.toggle(null, function (x, d) {
//                        io.sockets.emit('change', {id: d.id, state: x.value});
//                    });
//                }
//                self.state = curState;
//            });
//        }
    };

    self.toggle = function (state, callback) {
        console.log('toggle');

        self.state = state || (1 - (self.state || 0))
        if(typeof callback === 'function')
            callback(null, self);
//        if(self.actionType === 'onoff') {
//            self.state = state || (1 - (self.state || 0))
//            b.digitalWrite(self.pin, self.state, function (x) {
//                x = x || {};
//                if(x.err)
//                    self.state = 1 - self.state;
//
//                x.value = self.state;
//                if(typeof callback === 'function')
//                   callback(x, self);
//            });
//        } else if(self.actionType === 'switch') {
//            var controls = self.controls;
//            if(typeof controls === 'string') {
//                for (var i = 0, il = devices.length; i < il; i++) {
//                    if(devices[i].pin === controls) {
//                        controls = devices[i];
//                    }
//                }
//            }
//            controls.toggle(null, function (x, d) {
//                io.sockets.emit('change', {id: d.id, state: x.value});
//            });
//        }
    };

//    if(args.actionType && args.actionType === 'onoff') {
//        b.pinMode(self.pin, 'out');
//        b.digitalWrite(self.pin, (self.state || 0));
//    } else if(args.actionType && args.actionType === 'switch') {
//        b.pinMode(self.pin, 'in');
//
//        setInterval(self.switchCheck, self.freq);
//    } else if(args.actionType && args.actionType === 'sensor') {
//        if(analogPins.indexOf(self.pin) < 0) {
//            b.pinMode(self.pin, 'in');
//        }
//
//        setInterval(self.sensorCheck, self.freq);
//    }

    return self;
};

var devices = [];

devices.push(new Device('P8_8', {
    name: 'led',
    actionType: 'onoff',
    type: 'light',
    state: 0,
    isVisible: true
}));

devices.push(new Device('P8_10', {
    name: 'led 2',
    actionType: 'onoff',
    type: 'light',
    state: 0,
    isVisible: true
}));

fs.exists('./meinfo.json', function (exists) {
    if(exists) {
        fs.readFile('./meinfo.json', function (err, data) {
            if (err) throw err;

            me = JSON.parse(data);
            if(me.id) {
                conn.emit('initWorker', {
                    secret: secret,
                    devices: devices,
                    id: me.id
                });
            } else {
                conn.emit('initWorker', {
                    secret: secret,
                    devices: devices
                });
            }
        });
    } else {
        conn.emit('initWorker', {secret: secret, devices: devices}, function(resp, data) {
            console.log('server sent resp code ' + resp);
        });
    }

});

