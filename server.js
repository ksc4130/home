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
                remove: false,
                workers: []
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
            console.log('found', found);
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
            console.log('sess', client.session);
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
            devices: client.session.isAuth && client.session.workers && client.session.workers.length ? ko.utils.arrayFilter(devices, function (device) {
                return ko.utils.arrayFirst(client.session.workers, function (item) {

                   return item.workerId === device.workerId;
                });
            }) : [],
            workers: client.session.workers && client.session.workers.length ? ko.utils.arrayMap(client.session.workers, function (item) {
                return {_id: item._id, name: item.name};
            }) : []
        };
    };

    var clearSession = function (sess) {
        sess = sess || client.session;
        sess.userId = null;
        sess.isAuth = false;
        sess.email = null;
        sess.remember = false;
        client.session.workers = [];
    };

    var loginUser = function (err, loginModel, user, cb) {
        if(err || !user) {
            clearSession();
            loginModel.workers = [];
            loginModel.error = 'Unable to find email and password combo.';
        } else {
            loginModel.error = null;
            client.session.userId = user._id;
            client.session.isAuth = true;
            client.session.email = loginModel.email;
            client.session.remember = loginModel.remember || false;
            client.session.workers = user.workers || [];
            loginModel.workers = client.session.workers;
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
        if(!client.session.isAuth) {
            return;
        }

        if(!ko.utils.arrayFirst(client.session.workers, function (item) {
            return item.workerId === data.workerId;
        })) {
            console.log('************************addWorker', data);
            client.session.workers.push(data);
            updateSession();
            userRepo.updateUser({email: client.session.email, workers: client.session.workers});
        }
    });

    socket.on('setTrigger', function (data) {
        if(!client.session.isAuth)
            return;
        var device = ko.utils.arrayFirst(devices, function (item) {
           return item.id.toString() === data.id.toString()
        });

        if(typeof device !== 'undefined' && device !== null) {
            device.setTrigger(data.trigger);
        } else
            console.log("can't find device for id ", data.id);
    });

    socket.on('change', function (data) {
        if(!client.session.isAuth)
            return;

        var device;
        device = ko.utils.arrayFirst(devices, function (item) {
            return item.id.toString() === data.id.toString()
        });
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

    socket.on('thermo', function (data) {
        //console.log('worker thermo*************************', JSON.stringify(data));
        var device = ko.utils.arrayFirst(devices, function (item) {
            return item.id = data.id;
        });

        if(!device) {
            console.log("couldn't find device");
            return;
        }

        device.isHeat = data.isHeat;
        device.isCool = data.isCool;
        device.value = data.value;
        device.trigger = data.trigger;

        var found = ko.utils.arrayFilter(clients, function (client) {
            return client.session.isAuth && client.session.workers
                && ko.utils.arrayFirst(client.session.workers, function (item) {
                return item.workerId === device.workerId;
            });
        });

        ko.utils.arrayForEach(found, function (item) {
            item.socket.emit('thermo', {
                id: device.id,
                isHeat: device.isHeat,
                isCool: device.isCool,
                value: device.value,
                trigger: device.trigger
            });
        });
    });

    socket.on('change', function (data) {
        var device = ko.utils.arrayFirst(devices, function (item) {
            return item.id = data.id;
        });

        if(!device) {
            console.log("couldn't find device");
            return;
        }

        device.value = data.value;

        var found = ko.utils.arrayFilter(clients, function (client) {
            console.log('********lalal', client.session.workers);
            return client.session.isAuth
                && ko.utils.arrayFirst(client.session.workers, function (item) {
                return item.workerId === device.workerId;
            });
        });

        console.log('******************** clients found', found, device.workerId);

        ko.utils.arrayForEach(found, function (item) {
            item.socket.emit('change', {
                id: device.id,
                value: device.value
            });
        });
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

            var found = ko.utils.arrayFilter(clients, function (client) {
                if(client.session && client.session.workers.length)
                    return ko.utils.arrayFirst(client.session.workers, function (item) {
                        return item.workerId === data.id;
                    });
                else
                    return false;
            });
            if(found.length)
                socket.emit('transmit', true);

            console.log(data.workerId);
            var devs = ko.utils.arrayMap(data.devices, function (dev) {
                dev.socketId = socket.id;
                dev.workerId = data.workerId;
                dev.setTrigger = function (trigger) {
                    if(workers[socket.id]) {
                        dev.trigger = trigger;
                        workers[socket.id].socket.emit('setTrigger', {id: dev.id, trigger: trigger});
                    }
                };

                devices.push(dev);
                ko.utils.arrayForEach(found, function (item) {
                   item.socket.emit('add', {
                       id: dev.id,
                       type: dev.type,
                       actionType: dev.actionType,
                       value: dev.value,
                       trigger: dev.trigger,
                       isHeat: dev.isHeat,
                       isCool: dev.isCool
                   });
                });
                return dev;
            });

            workers[socket.id].devices = devs;

            socket.emit('devices', devs);

//            for(var ic = 0, ilc = clients.length; ic < ilc; ic++) {
//                clients[ic].emit('add', data.devices);
//            }
            //io.sockets.emit('refresh');
        }
    });
});

serverWorkers.listen(4131);