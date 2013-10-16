var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var cookie  = require('cookie');
var connect = require('connect');
var secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';


var util = require('util');


var app = express();

app.set('port', process.env.PORT || 4130);
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


var clients = {};
var devices = [];

io.sockets.on('connection', function (socket) {
    var mac = socket.handshake.address;

    var sessId = sessionobj[cookie.parse(socket.handshake.sessionID)];
    var yup = sessionobj[sessId];


    if(yup)
        socket.emit('init', devices);
    else
        socket.emit('yup', false);



    socket.on('yup', function (data) {
        data = data || {};
        yup = (data.pin === pin);
        console.log('yup', JSON.stringify(data));

        if(yup) {
            sessionobj[sessId] = data.remember || false;
            socket.emit('init', devices);
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
            var w = workers[device.socketId];

            if(w) {
                w.socket.emit('change', data);
            }
        else
            console.log("can't find device for id ", data.id);
    });

});


var WorkerProvider = require('./workerProvider').WorkerProvider;
var workerProvider= new WorkerProvider('localhost', 27017);
var serverWorkers = require('http').Server();
var ioWorkers = require('socket.io').listen(serverWorkers);
var workers = {};

ioWorkers.on('connection', function (socket) {
    socket.on('change', function (data) {
        console.log('worker change', JSON.stringify(data));
        io.sockets.emit('change', data);
    });

    socket.on('disconnect', function() {
        console.log('Got disconnect!');

        if(!workers[socket.id])
            return;

        //var id = workers[socket.id].id;
        workers[socket.id] = null;
//            workerProvider.findById(id, function (err, w) {
//                if(err) throw err;
//                w.socketId = null;
//                workerProvider.save(w, function (err, ww) {
//                    if(err) throw err;
//                });
//            });
    });
    socket.on('initWorker', function (data) {
        var i,
            worker;

        workers[socket.id] = {
            socket: socket
        };

//        if(data.id && typeof data.id === 'string') {
//            //check db
//            workerProvider.findById(data.id, function (err, worker) {
//                if(err) throw err;
//
//                worker = worker || {};
//                worker.socketId = socket.id;
//                workerProvider.save(worker, function (err, w) {
//                    if(err) throw err;
//
//                    socket.emit('initWorker', {id: w._id});
//                });
//            });
//        } else {
//            workerProvider.save({socketId: socket.id}, function (err, w) {
//                if(err) throw err;
//
//                socket.emit('initWorker', {id: w._id});
//            });
//        }

        for(i = 0; i < data.devices.length; i++) {
            console.log(data.devices[i]);
            data.devices[i].socketId = socket.id;
            devices.push(data.devices[i]);
        }
        io.sockets.emit('refresh');
    });
});

serverWorkers.listen(4131);