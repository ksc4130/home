var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var cookie  = require('cookie');
var connect = require('connect');
var secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';

var app = express();

// all environments
app.set('port', process.env.PORT || 4130);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
//app.use(express.cookieParser('your secret here'));
//app.use(express.session());

app.use(express.cookieParser());
app.use(express.session({secret: secret, key: 'express.sid'}));

app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));


if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
//app.get('/users', user.list);

var server = http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});

var sessionobj = {};
var io = require('socket.io').listen(server);
var pin = '41300048';

io.set('authorization', function (handshakeData, accept) {

    if (handshakeData.headers.cookie) {

        handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);

        handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], secret);

        if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
            return accept('Cookie is invalid.', false);
        }

    } else {
        return accept('No cookie transmitted.', false);
    }

    accept(null, true);
});

io.sockets.on('connection', function (socket) {
    var sessId = sessionobj[cookie.parse(socket.handshake.sessionID)];
    var yup = sessionobj[sessId];

    if(yup)
        socket.emit('init', devicesToSend);
    else
        socket.emit('yup', false);

    socket.on('yup', function (data) {
        data = data || {};
        yup = (data.pin === pin);
        if(yup) {
            sessionobj[sessId] = data.remember;
            socket.emit('init', devicesToSend);
        } else {
            sessionobj[sessId] = false;
            socket.emit('yup', false);
        }
    });
    socket.on('change', function (data) {
        if(!yup) {
            socket.emit('yup', false);
            return;
        }
        var device;
        for(var i = 0, il = devices.length; i < il; i++) {
            if(devices[i].id === data.id) {
                device = devices[i];
                break;
            }
        }
        if(device)
            device.toggle(data.state, function (x, d) {
                if(d.isVisible)
                    io.sockets.emit('change', {id: d.id, state: x.value});
            });
        else
            console.log("can't find device for id ", data.id);
    });
});

var b = require('bonescript');

var idDeviceCnt = 0;
var idGroupCnt = 0;

var analogPins = [
    'P9_33',
    'P9_35',
    'P9_36',
    'P9_37',
    'P9_38',
    'P9_39',
    'P9_40',
]

var Group = function (args) {
    var self = this;

    args = args || {};

    self.id = idGroupCnt++;
    self.name = args.name;
    self.childGroups = args.childGroups || [];
    self.devices = args.devices || [];

    return self;
};

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
        b.digitalRead(self.pin, function (x) {
            var curState = x.value;
            if(curState < self.state) {
                self.toggle();
            }
            self.state = curState;
        });
    };

    self.sensorCheck = function () {
        if(analogPins.indexOf(self.pin) > -1) {
            b.analogRead(self.pin, function (x) {
                var curState = x.value;
                //console.log(curState);
                self.state = curState;
            });
        } else {
            b.digitalRead(self.pin, function (x) {
                var curState = x.value;
                if(curState < self.state) {
                    self.toggle(null, function (x, d) {
                        io.sockets.emit('change', {id: d.id, state: x.value});
                    });
                }
                self.state = curState;
            });
        }
    };

    self.toggle = function (state, callback) {
        if(self.actionType === 'onoff') {
            self.state = state || (1 - (self.state || 0))
            b.digitalWrite(self.pin, self.state, function (x) {
                x = x || {};
                if(x.err)
                    self.state = 1 - self.state;

                x.value = self.state;
                if(typeof callback === 'function')
                    callback(x, self);
            });
        } else if(self.actionType === 'switch') {
            var controls = self.controls;
            if(typeof controls === 'string') {
                for (var i = 0, il = devices.length; i < il; i++) {
                    if(devices[i].pin === controls) {
                        controls = devices[i];
                    }
                }
            }
            controls.toggle(null, function (x, d) {
                io.sockets.emit('change', {id: d.id, state: x.value});
            });
        }
    };

    if(args.actionType && args.actionType === 'onoff') {
        b.pinMode(self.pin, 'out');
        b.digitalWrite(self.pin, (self.state || 0));
    } else if(args.actionType && args.actionType === 'switch') {
        b.pinMode(self.pin, 'in');

        setInterval(self.switchCheck, self.freq);
    } else if(args.actionType && args.actionType === 'sensor') {
        if(analogPins.indexOf(self.pin) < 0) {
            b.pinMode(self.pin, 'in');
        }

        setInterval(self.sensorCheck, self.freq);
    }

    return self;
};


var devices = [];
var devicesToSend = [];
var groups = {};

devices.push(new Device('P8_8', {
    name: 'led',
    actionType: 'onoff',
    type: 'light',
    state: 0,
    isVisible: true
}));

devices.push(new Device('P8_12', {
    name: 'led switch',
    actionType: 'switch',
    type: 'light',
    controls: 'P8_8'
}));

devices.push(new Device('P8_10', {
    name: 'led 2',
    actionType: 'onoff',
    type: 'light',
    state: 0,
    isVisible: true
}));

devices.push(new Device('P8_14', {
    name: 'led 2 switch',
    actionType: 'switch',
    type: 'light',
    controls: 'P8_10'
}));

devices.push(new Device('P9_36', {
    name: 'photo',
    actionType: 'sensor',
    type: 'light'
}));

for(var i = 0, il = devices.length; i < il; i++) {
    if(devices[i].isVisible)
        devicesToSend.push(devices[i]);
}
