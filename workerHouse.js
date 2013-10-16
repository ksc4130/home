var io = require('socket.io-client');
var fs = require('fs');
var serverUrl = 'http://localhost:4131';
var conn = io.connect(serverUrl);
var secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';
var util = require('util');
var device = require('./device');
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

var devices = [
    device('P8_8', {
        name: 'Den',
        actionType: 'onoff',
        type: 'light',
        state: 0,
        isVisible: true
    }),
    device('P8_10', {
        name: 'Garage Door',
        actionType: 'momentary',
        type: 'overheadDoor',
        state: 0,
        isVisible: true
    }),
    device('P8_12', {
        name: 'Den switch',
        actionType: 'switch',
        type: 'light',
        controls: 'P8_8'
    })
];

devices[2].on('switched', function (self) {
   devices[0].toggle();
});


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
