var express = require('express')
    ,routes = require('./routes')
    , http = require('http')
    , https = require('https')
    , path = require('path')
    , cookie  = require('cookie')
    , connect = require('connect')
    , fs = require('fs')
    , bcrypt = require('bcrypt');


var secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';
var options = {
    key: fs.readFileSync('./privatekey.pem'),
    cert: fs.readFileSync('./certificate.pem'),
    requestCert: true
};

bcrypt.genSalt(10, function(err, salt) {
    bcrypt.hash('pass', salt, function(err, hash) {
        console.log('pass', hash);
    });
});


var app = express();
var httpApp = express();

app.set('port', process.env.PORT || 443);
app.set('httpPort', process.env.PORT || 80);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({secret: secret, key: 'express.sid'}));

app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));


if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

httpApp.get('*', function (req, res) {
    console.log('redirecting to https');
    res.redirect('https://' + req.host + req.originalUrl);
});

var httpServer = http.createServer(httpApp).listen(app.get('httpPort'), function(){
    console.log('Express server listening on port ' + app.get('httpPort'));
});

app.get('/', routes.index);
//app.get('/users', user.list);


var server = https.createServer(options, app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
});

var sessionobj = {};
var io = require('socket.io').listen(server, {secure: true});
var pin = '41300048';

io.configure('production', function(){
    io.enable('browser client minification');
    io.enable('browser client etag');
    io.enable('browser client gzip');
    io.set('log level', 1);

    io.set('transports', [
        'websocket'
        , 'flashsocket'
        , 'htmlfile'
        , 'xhr-polling'
        , 'jsonp-polling'
    ]);
});

//io.configure('development', function(){
//    io.set('transports', ['websocket']);
//});

io.set('authorization', function (handshakeData, accept) {

    if (handshakeData.headers.cookie) {

        handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);

        handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], secret);

        //console.log('********************', handshakeData.headers.cookie);
        //console.log('********************', handshakeData.sessionID);

        if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
            return accept('Cookie is invalid.', false);
        }
    } else {
        return accept('No cookie transmitted.', false);
    }

    accept(null, true);
});


var clients = [];
var devices = [];

io.sockets.on('connection', function (socket) {
    //tell workers to transmit
    ioWorkers.sockets.emit('transmit', true);

    var mac = socket.handshake.address;

    var sessId = socket.handshake.sessionID;
    console.log('*********connection', mac, sessId);
    var yup = sessionobj[sessId];

    console.log('session id', sessId, yup);

    if(yup === true)
        socket.emit('init', devices);
    else
        socket.emit('yup', false);

    socket.on('disconnect', function() {
        if(clients.indexOf(socket) > -1) {
            clients.splice(clients.indexOf(socket), 1);
        }
        if(clients.length <= 0) {
            io.sockets.emit('transmit', false);
        }
    });

    socket.on('yup', function (data) {
        data = data || {};
        yup = (data.pin === pin);
        console.log('yup', JSON.stringify(data));

        if(yup === true) {
            sessionobj[sessId] = data.remember || false;
            socket.emit('init', devices);
            clients.push(socket);
        } else {
            if(clients.indexOf(socket) > -1) {
                clients.remove(socket);
            }
            sessionobj[sessId] = false;
            socket.emit('yup', false);
        }
    });

    socket.on('setTrigger', function (data) {
        var device;

        for(var i = 0, il = devices.length; i < il; i++) {
            if(devices[i].id.toString() === data.id.toString()) {
                device = devices[i];
                break;
            }
        }

        if(typeof device !== 'undefined' && device !== null) {
            device.setTrigger(data.trigger);
        } else
            console.log("can't find device for id ", data.id);
    });

    socket.on('change', function (data) {
        if(yup !== true) {
            if(clients.indexOf(socket) > -1) {
                clients.remove(socket);
            }
            socket.emit('yup', false);
            return;
        }
        var device;
        //console.log(devices, data.id);

        for(var i = 0, il = devices.length; i < il; i++) {
            if(devices[i].id.toString() === data.id.toString()) {
                device = devices[i];
                break;
            }
        }
        //console.log('device', device);
        if(typeof device !== 'undefined' && device !== null) {
            var w = workers[device.socketId];

            if(w) {
                w.socket.emit('change', data);
            }
        } else
            console.log("can't find device for id ", data.id);
    });

});


//var WorkerProvider = require('./workerProvider').WorkerProvider;
//var workerProvider= new WorkerProvider('localhost', 27017);
var serverWorkers = require('http').Server();
var ioWorkers = require('socket.io').listen(serverWorkers);
var workers = {};
var deviceIdCnt = 0;

ioWorkers.configure('production', function(){
    ioWorkers.enable('browser client minification');
    ioWorkers.enable('browser client etag');
    ioWorkers.enable('browser client gzip');
    ioWorkers.set('log level', 1);

    ioWorkers.set('transports', [
        'websocket'
        , 'flashsocket'
        , 'htmlfile'
        , 'xhr-polling'
        , 'jsonp-polling'
    ]);
});

ioWorkers.on('connection', function (socket) {

    socket.emit('initWorker');
    if(clients.length > 0)
        socket.emit('transmit', true);

    socket.on('thermo', function (data) {
        //console.log('worker thermo*************************', JSON.stringify(data));
        for(var i = 0, il = devices.length; i < il; i++) {
            (function (dev) {
                if(dev.id === data.id) {
                    dev.isHeat = data.isHeat;
                    dev.isCool = data.isCool;
                    dev.value = data.value;
                }
            }(devices[i]));
        }
        io.sockets.emit('thermo', data);
    });

    socket.on('change', function (data) {
        //console.log('worker change*************************', JSON.stringify(data));
        for(var i = 0, il = devices.length; i < il; i++) {
            (function (dev) {
                if(dev.id === data.id) {
                    dev.value = data.value;
                }
            }(devices[i]));
        }
        io.sockets.emit('change', data);
    });

    socket.on('disconnect', function() {
        console.log('worker disconnect!');

        if(!workers[socket.id])
            return;

        //var id = workers[socket.id].id;
//        workers[socket.id] = null;
//            workerProvider.findById(id, function (err, w) {
//                if(err) throw err;
//                w.socketId = null;
//                workerProvider.save(w, function (err, ww) {
//                    if(err) throw err;
//                });
//            });
        var a = [],
            toRemove = [];

        for(var i = 0; i < devices.length; i++) {
            if(devices[i].socketId !== socket.id) {
                a.push(devices[i]);
            } else {
                toRemove.push(devices[i].id);
            }
        }
        devices = a;
        workers[socket.id] = null;
        //console.log('remove clients', clients);
        for(var ic = 0, ilc = clients.length; ic < ilc; ic++) {
            clients[ic].emit('remove', toRemove);
        }
    });

    socket.on('initWorker', function (data) {
        if(data.secret === secret) {
            var i,
                worker,
                workerDev;

            workers[socket.id] = {
                socket: socket,
                devices: []
            };

            for(i = 0; i < data.devices.length; i++) {
                (function (sId) {
                    (function (dev) {
                        dev.socketId = sId;
                        dev.setTrigger = function (trigger) {
                            if(workers[socket.id]) {
                                dev.trigger = trigger;
                                workers[socket.id].socket.emit('setTrigger', {id: dev.id, trigger: trigger});
                            }
                        };
                        workers[socket.id].devices.push(dev);
                        devices.push(dev);
                    }(data.devices[i]));
                }(socket.id));
            }
            socket.emit('devices', workers[socket.id].devices);
            for(var ic = 0, ilc = clients.length; ic < ilc; ic++) {
                clients[ic].emit('add', data.devices);
            }
            //io.sockets.emit('refresh');
        }
    });
});

serverWorkers.listen(4131);