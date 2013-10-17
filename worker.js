var io = require('socket.io-client');
var fs = require('fs');
var serverUrl = 'http://192.168.1.10:4131';
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

conn.on('devices', function (data) {
    for(var i = 0, il = data.length; i < il; i++) {
        var dev = device(null, data[i]);

        if(dev.name === 'Den') {
            dev.on('change', function (d) {
                console.log('change***********', d);
                conn.emit('change', {id: d.id, state: d.state});
            });
        }
        devices.push(dev);
    }
    //console.log(devices);
});

conn.on('change', function (data) {
    console.log('change', util.inspect(data));
    var device;

    for(var i = 0, il = devices.length; i < il; i++) {
        if(devices[i].id.toString() === data.id.toString()) {
            device = devices[i];
            break;
        }
    }
    if(typeof device !== 'undefined' && device !== null) {
        device.toggle(function (x, d) {
            //if(d.isVisible)
            conn.emit('change', {id: device.id, state: d});
        });
    } else
        console.log("can't find device for id ", data.id);

});

var devices = [
//    device(27, {
//        name: 'Lights',
//        type: 'light',
//        actionType: 'onoff',
//        state: 0,
//        isVisible: true
//    }),
//    device(17, {
//        name: 'Flood Lights',
//        type: 'light',
//        actionType: 'onoff',
//        state: 0,
//        isVisible: true
//    }),
//    device(24, {
//        name: 'Motion',
//        type: 'motion',
//        //direction: 'in',
//        actionType: 'sensor',
//        //state: 0,
//        isVisible: true
//    }),
//    device(22, {
//        name: 'Flood Lights Switch',
//        type: 'light',
//        //direction: 'in',
//        actionType: 'switch',
//        controls: 17
//        //state: 0,
//        //isVisible: true
//    }),
//    device(23, {
//        name: 'Barn Lights Switch',
//        type: 'light',
//        //direction: 'in',
//        actionType: 'switch',
//        controls: 27
//        //state: 0,
//        //isVisible: true
//    })
];

var floodLightsSwitch = device(22, {
        name: 'Flood Lights Switch',
        type: 'light',
        //direction: 'in',
        actionType: 'switch',
        controls: 17
        //state: 0,
        //isVisible: true
    }),
    barnLightSwitch = device(23, {
        name: 'Barn Lights Switch',
        type: 'light',
        //direction: 'in',
        actionType: 'switch',
        controls: 27
        //state: 0,
        //isVisible: true
    });

floodLightsSwitch.on('switched', function (self) {
    for(var i = 0, il = devices.length; i < il; i++) {
        if(devices[i].pin === floodLightsSwitch.controls) {
            devices[i].toggle(function (err, d) {
                conn.emit('change', {id: devices[i].id, state: d});
            });
        }
    }
});

barnLightSwitch.on('switched', function (self) {
    for(var i = 0, il = devices.length; i < il; i++) {
        if(devices[i].pin === barnLightSwitch.controls) {
            devices[i].toggle(function (err, d) {
                conn.emit('change', {id: devices[i].id, state: d});
            });
        }
    }
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
        conn.emit('initWorker', {secret: secret, devices: [
            {
                pin: 27,
                name: 'Lights',
                type: 'light',
                actionType: 'onoff',
                state: 0,
                isVisible: true
            },
            {
                pin: 17,
                name: 'Flood Lights',
                type: 'light',
                actionType: 'onoff',
                state: 0,
                isVisible: true
            },
            {
                pin: 24,
                name: 'Motion',
                type: 'motion',
                //direction: 'in',
                actionType: 'sensor',
                //state: 0,
                isVisible: true
            }//,
//            {
//                pin: 22,
//                name: 'Flood Lights Switch',
//                type: 'light',
//                //direction: 'in',
//                actionType: 'switch',
//                controls: 17
//                //state: 0,
//                //isVisible: true
//            },
//            {
//                pin: 23,
//                name: 'Barn Lights Switch',
//                type: 'light',
//                //direction: 'in',
//                actionType: 'switch',
//                controls: 27
//                //state: 0,
//                //isVisible: true
//            }
        ]}, function(resp, data) {
            console.log('server sent resp code ' + resp);
        });
    }

});

