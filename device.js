
(function () {
    var idDeviceCnt = 0,
        device,
        bbbToggle,
        b,
        gpio,
        boardType,
        inputActionTypes = [
            'switch',
            'sensor'
        ],
        outputActionTypes = [
            'onoff',
            'momentary'
        ],
        bbbAnalogPins = [
            'P9_33',
            'P9_35',
            'P9_36',
            'P9_37',
            'P9_38',
            'P9_39',
            'P9_40'
        ];

    try {
        console.log(require.resolve("bonescript"));
        b = require('bonescript');
        boardType = boardType || 'bbb';
    } catch(e) {
        console.log("bonescript was not found");
    }

    try {
        console.log(require.resolve("gpio"));
        gpio = require('gpio');
        boardType = boardType || 'gpio';
    } catch(e) {
        console.log("gpio was not found");
    }

    device = function (pin, args) {
        if(this === global)
            return new device(pin, args);

        var self = this;

        args = args || {};

        self.id = args.id;
        self.actionType = args.actionType;
        self.type = args.type;
        self.direction = (inputActionTypes.indexOf(self.actionType) > -1) ? 'in' :
                            (outputActionTypes.indexOf(self.actionType) > -1) ? 'out' : null;
        self.pin = pin || (args.pin || '');
        self.name = args.name || 'untitled';
        self.state = args.state;
        self.controls = args.controls;
        self.freq = args.freq || 5;
        self.isVisible = args.isVisible || false;
        self.gpio = null;

        self.subs = {};

        if(!self.direction) {
            console.log('unknown action type unable to set direction', self.actionType, self.direction);
            return self;
        }

        if(boardType === 'bbb') {
            b.pinMode(self.pin, self.direction);
            if(self.direction === 'out') {
                if(bbbAnalogPins.indexOf(self.pin) > -1) {
                    b.analogWrite(self.pin, self.state);
                } else {
                    b.digitalWrite(self.pin, self.state);
                }
            } else {
                if(args.actionType && args.actionType === 'switch') {
                    b.pinMode(self.pin, 'in');

                    setInterval(function () {
                        self.get(function(err, val) {
                            if(val < self.state) {
                                //self.toggle();
                                self.pub('switched', self);
                            }
                            if(self.state !== val) {
                                self.state = val;
                                self.pub('change', self);
                            }
                        });
                    }, self.freq);
                } else if(args.actionType && args.actionType === 'sensor') {
                    if(bbbAnalogPins.indexOf(self.pin) < 0) {
                        b.pinMode(self.pin, 'in');
                    }

                    setInterval(function () {
                        self.get(function(err, val) {
                            if(self.state !== val) {
                                self.state = val;
                                self.pub('change', self);
                            }
                        });
                    }, self.freq);
                }
            }
        } else if(boardType === 'gpio') {
            self.gpio = gpio.export(pin, {
                direction: self.direction,
                interval: 200,
                ready: function() {
                    if(self.direction === 'in') {
                        self.gpio.on("change", function(val) {
                            self.state = val;
                            self.pub('change', null, self);
                            //io.sockets.emit('change', {id: self.id, state: val});
                        });
                    }
                }
            });
        }

        return self;
    };

    device.prototype.switchCheck = function () {
        var self = this;
        self.get(function(err, val) {
            if(val < self.state) {
                //self.toggle();
                self.pub('switched', self);
            }
            if(self.state !== val) {
                self.state = val;
                self.pub('change', self);
            }
        });
    };

    device.prototype.sensorCheck = function () {
        var self = this;
        self.get(function(err, val) {
            if(self.state !== val) {
                self.state = val;
                self.pub('change', self);
            }
        });
    };

    device.prototype.on = function (event, callback) {
        var self = this;

        self[event] = self[event] || [];
        self[event].push(callback);
    };

    device.prototype.off = function (event, callback) {
        var self = this;
        if(self.subs[event]) {
            self[event].remove(callback);
            if(self.subs[event].length <= 0) {
                delete self.subs[event];
            }
        }
    };

    device.prototype.pub = function (event, err, args) {
        var self = this;
        if(self.subs[event]) {
            for(var i = 0, il = self.subs[event].length; i < il; i++) {
                self.subs[event][i](err, args);
            }
        }
    }

    device.prototype.toggle = function (callback) {
        var self = this,
            ns = 1 - self.state;
        if (self.actionType === 'momentary') {
            self.set(1, function () {
                setTimeout(function () {
                    self.set(0, callback);
                }, 250);
            });
        } else if(self.actionType === 'switch') {
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
        } else {
            self.set(ns, callback);
        }
    };

    device.prototype.get = function (val, callback) {
        var self = this,
            hasCallback = typeof callback === 'function';

        if(boardType === 'bbb') {
            if(bbbAnalogPins.indexOf(self.pin) > -1) {
                b.analogRead(self.pin, val,function (x) {
                    if(!x.err)
                        self.state = x.value;
                    if(hasCallback)
                        callback(x.err, self.state);
                });
            } else {
                b.digitalRead(self.pin, function (x) {
                    if(!x.err)
                        self.state = x.value;
                    if(hasCallback)
                        callback(x.err, self.state);
                });
            }
        } else if(boardType === 'gpio') {
            if(!x.err)
                self.state = self.gpio.value;
            if(hasCallback)
                callback(null, self.state);
        }
    };

    device.prototype.set = function (val, callback) {
        var self = this,
            hasCallback = typeof callback === 'function';

        if(boardType === 'bbb') {
            if(bbbAnalogPins.indexOf(self.pin) > -1) {
                b.analogWrite(self.pin, val, function (err) {
                    if(!err)
                        self.state = val;
                    if(hasCallback)
                        callback(x.err, self.state);
                });
            } else {
                b.digitalWrite(self.pin, val, function (err) {
                    if(!err)
                        self.state = val;
                    if(hasCallback)
                        callback(x.err, self.state);
                });
            }
        } else if(boardType === 'gpio') {
            self.gpio.set(val, function () {
                self.state = self.gpio.value;
                if(hasCallback)
                    callback(x.err, self.state);
            });
        }
    };

    module.exports = device;
}());