var express = require('express')
    , routes = require('./routes')
    , http = require('http')
    , https = require('https')
    , path = require('path')
    , cookie  = require('cookie')
    , connect = require('connect')
    , globals = require('./globals')
    , fs = require('fs')
    , bcrypt = require('bcrypt')
    , ko = require('knockout')
    , db = require("mongojs").connect(globals.dbName, globals.collections)
    , userRepo = require('./userRepo')
    , SessionStore = require('connect-mongo')(express)
    , sessionStore = new SessionStore({db: globals.dbName})
    , moment = require('moment')
    , secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';;


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

app.use(express.session({secret: globals.secret, key: 'kyngster.sid', store: sessionStore,
    cookie : {
        //secure : true//,
        //maxAge: 5184000000 // 2 months
    }
}));
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

//var sessionobj = {};
var io = require('socket.io').listen(server, {secure: true});
//var pin = '41300048';

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

io.configure('development', function(){
    io.set('transports', ['websocket']);
});

io.set('authorization', function (handshakeData, accept) {

    if (handshakeData.headers.cookie) {

        handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);

        handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['kyngster.sid'], secret);

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

//var findUser = function (email, pass, cb) {
//    bcrypt.hash(pass, email + secret, function(err, hash) {
//        db.find('users',
//            {email: email, pass: hash},
//            function (err, cursor, count) {
//                if(err) {
//                    console.error(err);
//                    cb(err, null);
//                    return;
//                }
//                if(count > 0) {
//                    cb(null, cursor.object());
//                } else {
//                    cb(null, null);
//                }
//            }
//        );
//    });
//};


var clients = [];
var devices = [];

io.sockets.on('connection', function (socket) {
    //tell workers to transmit

    var client = ko.utils.arrayFirst(clients, function (item) {
        return item.sessId === socket.id;
    });

    if(!client) {
        client = {
            socketId: socket.id,
            socket: socket,
            session: {
                sessId: socket.handshake.sessionID,
                isAuth: false,
                remove: false
            }
        };
    } else {
        client.session.remove = false;
    }

    var updateSession = function (sess, cb) {
        sess = sess || client.session;
        cb = cb || function () {};
        db.userSessions.update({sessId: client.session.sessId}, sess, { upsert: true }, cb);
    };

    var checkTransmit = function () {
        if(ko.utils.arrayFirst(clients, function (item) {
           return item.session.isAuth;
        })) {
            ioWorkers.sockets.emit('transmit', true);
        } else {
            ioWorkers.sockets.emit('transmit', false);
        }
    };

    db.userSessions.findOne({sessId: client.session.sessId}, function (err, found) {
        if(found) {
            found.remove = client.session.remove;
            client.session = found;
        }
        var secondsDiff = moment().diff(client.session.lastAccess);
        if(secondsDiff > 360000 && !client.session.remember) {
            client.session.isAuth = false;
            client.session.userId = null;
            client.session.isAuth = false;
            client.session.email = null;
            client.session.remember = false;
        }
        updateSession(null, function (err, saved) {
            if(!found) {
                updateSession(null, function (err, found) {
                    client.session._id = found._id;
                });
            }
            if(clients.indexOf(client) <= -1)
                clients.push(client);

            checkTransmit();
            socket.emit('init', cleanLoginModel(client.session));
        });
    });

    var cleanLoginModel = function (loginModel) {
        return {
            isAuth:  typeof loginModel.isAuth === 'function' ? loginModel.isAuth() : loginModel.isAuth,
            remember: loginModel.remember,
            email: loginModel.email,
            fname: loginModel.fname,
            lname: loginModel.lname,
            dob: loginModel.dob,
            error: loginModel.error,
            devices: client.isAuth ? devices : []
        };
    };

    var clearSession = function (sess) {
        sess = sess || client.session;
        sess.userId = null;
        sess.isAuth = false;
        sess.email = null;
        sess.remember = false;
    };

    var loginUser = function (err, loginModel, user, cb) {
        if(err || !user) {
            clearSession();
            loginModel.error = 'Unable to find email and password combo.';
        } else {
            loginModel.error = null;
            client.session.userId = user._id;
            client.session.isAuth = true;
            client.session.email = loginModel.email;
            client.session.remember = loginModel.remember || false;
        }
        loginModel.confirmPassword = null;
        loginModel.password = null;
        loginModel.isAuth = client.session.isAuth;
        updateSession();
        checkTransmit();
        cb(loginModel.error, cleanLoginModel(loginModel));
    };

    socket.on('disconnect', function () {
        client.session.remove = true;
        client.session.lastAccess = new Date();
        updateSession(null, function (err, saved) {
            console.log('desconect', client.session.lastAccess, saved);
            if(client.session.remove)
                ko.utils.arrayRemoveItem(clients, client);
        });
        checkTransmit();
    });

    socket.on('login', function (loginModel, cb) {
        userRepo.findUser(loginModel.email, loginModel.password,
            function (err, user) {
                loginUser(err, loginModel, user, cb);
            });
    });

    socket.on('logoff', function (cb) {
        clearSession();
        checkTransmit();
        updateSession(null, function (err, saved) {
            cb(!err);
        })
    });

    socket.on('register', function (loginModel, cb) {
        userRepo.checkEmail(loginModel.email,
            function (err, user) {
                if(err || user) {
                    //failed login
                    clearSession();
                    updateSession();
                    loginModel.error = 'Email has already been registered.';
                    loginModel.password = null;
                    loginModel.confirmPassword = null;
                    loginModel.isAuth = client.isAuth;
                    cb(loginModel.error, cleanLoginModel(loginModel));
                } else {
                    userRepo.createUser({
                        email: loginModel.email,
                        password: loginModel.password,
                        fname: loginModel.fname,
                        lname: loginModel.lname,
                        dob: loginModel.dob
                    }, function (err, user) {
                        loginUser(err, loginModel, user, cb);
                    });
                }
            });
    });

    socket.on('addWorker', function (data) {
        if(client.isAuth) {

        }
    });

    socket.on('setTrigger', function (data) {
        if(!client.isAuth)
            return;
        var device;
        console.log('set trigger', data);
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
        if(!client.isAuth)
            return;
        console.log('change', sessionobj[sessId], yup);
        if(yup !== true) {
            if(clients.indexOf(socket) > -1) {
                clients.remove(socket);
            }
            socket.emit('yup', false);
            return;
        }
        var device;
        //console.log(devices, data.id);
        console.log('change a');
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
                    dev.trigger = data.trigger;
                }
            }(devices[i]));
        }
        io.sockets.emit('thermo', data);
    });

    socket.on('change', function (data) {
        console.log('worker change*************************', data.id, data.value);
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
//        for(var ic = 0, ilc = clients.length; ic < ilc; ic++) {
//            clients[ic].emit('remove', toRemove);
//        }
        io.sockets.emit('remove', toRemove);
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
                        io.sockets.emit('add', [dev]);
                    }(data.devices[i]));
                }(socket.id));
            }
            socket.emit('devices', workers[socket.id].devices);

//            for(var ic = 0, ilc = clients.length; ic < ilc; ic++) {
//                clients[ic].emit('add', data.devices);
//            }
            //io.sockets.emit('refresh');
        }
    });
});

serverWorkers.listen(4131);