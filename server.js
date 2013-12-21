var express = require('express')
    , routes = require('./routes')
    , http = require('http')
    , https = require('https')
    , path = require('path')
    , cookie  = require('cookie')
    , connect = require('connect')
    , moment = require('moment')
    , fs = require('fs')
    , ko = require('knockout')
    , globals = require('./globals')
    , userRepo = require('./userRepo')
    , db = require("mongojs").connect(globals.dbName, globals.collections)
    , SessionStore = require('connect-mongo')(express)
    , sessionStore = new SessionStore({db: globals.dbName})
    , clients = []
    , devices = [];

var options = {
    key: fs.readFileSync('./privatekey.pem'),
    cert: fs.readFileSync('./certificate.pem'),
    requestCert: true
};

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

app.use(express.session({
    secret: globals.secret,
    key: 'kyngster.sid',
    store: sessionStore,
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

var io = require('socket.io').listen(server, {secure: true});

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

        handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['kyngster.sid'], globals.secret);

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


io.sockets.on('connection', function (socket) {
    //tell workers to transmit

    var client = ko.utils.arrayFirst(clients, function (item) {
        return item.socketId === socket.id;
    });

    if(!client) {
        console.log('!client');
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
        console.log('client', client);
        client.session.remove = false;
    }

    var updateSession = function (sess, cb) {
        sess = sess || client.session;
        cb = cb || function () {};
        db.userSessions.update({sessId: client.session.sessId}, sess, { upsert: true }, cb);
//        db.userSessions.findOne({sessId: client.session.sessId}, function (err, found) {
//            if(err || !found) {
//                db.userSessions.update({sessId: client.session.sessId}, sess, { upsert: true }, cb);
//            } else {
//                db.userSessions.update({sessId: client.session.sessId}, {$set: sess}, cb);
//            }
//        });

    };

    var checkTransmit = function () {
        if(ko.utils.arrayFirst(clients, function (item) {
           return item.session.isAuth;
        })) {
            console.log('transmit', true);
            ioWorkers.sockets.emit('transmit', true);
        } else {
            console.log('transmit', false);
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
            console.log('expired');
            client.session.isAuth = false;
            client.session.userId = null;
            client.session.isAuth = false;
            client.session.email = null;
            client.session.remember = false;
        }

        if(client.session.isAuth) {
            client.session.devices =  ko.utils.arrayFilter(devices, function (d) {
                var t = ko.utils.arrayFirst(client.session.workers, function (w) {
                    return w.workerId === d.workerId;
                });
                return d.id && t
            });
            //console.log('**************************************** distinct devs client sess', client.session.devices.length, ko.utils.arrayGetDistinctValues(ko.utils.arrayMap(client.session.devices, function (dddd) {
//                return dddd.id;
//            })).length);
            //console.log('**************************************** distinct devs client sess', devices.length, ko.utils.arrayGetDistinctValues(ko.utils.arrayMap(devices, function (dddd) {
//                return dddd.id;
//            })).length);
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
        var workers = client.session.workers && client.session.workers.length ? ko.utils.arrayMap(client.session.workers, function (item) {
            return {_id: item._id, name: item.name};
        }) : [];

        var devs =  ko.utils.arrayMap(client.session.devices, function (dev) {
                return {
                    id: dev.id,
                    name: dev.name,
                    type: dev.type,
                    actionType: dev.actionType,
                    value: dev.value,
                    trigger: dev.trigger,
                    threshold: dev.threshold,
                    highThreshold: dev.highThreshold,
                    lowThreshold: dev.lowThreshold,
                    isHigh: dev.isHigh,
                    isLow: dev.isLow
                };
            });

        return {
            isAuth:  typeof loginModel.isAuth === 'function' ? loginModel.isAuth() : loginModel.isAuth,
            remember: loginModel.remember,
            email: loginModel.email,
            fname: loginModel.fname,
            lname: loginModel.lname,
            dob: loginModel.dob,
            error: loginModel.error,
            devices: devs || [],
            workers: workers
        };
    };

    var clearSession = function (sess) {
        sess = sess || client.session;
        sess.userId = null;
        sess.isAuth = false;
        sess.email = null;
        sess.remember = false;
        client.session.devices = [];
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
            checkTransmit();
        });
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
           return item && item.id && item.id.toString() === data.id.toString()
        });

        if(typeof device !== 'undefined' && device !== null) {
            device.setTrigger(data.trigger);
        } else
            console.log("can't find device for id ", data.id);
    });

    socket.on('change', function (data) {
        if(!client.session.isAuth)
            return;

        var device = ko.utils.arrayFirst(devices, function (item) {
            return item.id && item.id.toString() === data.id.toString()
        });
        console.log('****************************change device', device);
        if(typeof device !== 'undefined' && device !== null) {
            var w = ko.utils.arrayFirst(workers, function (w) {
                return w.workerId === device.workerId;
            });
            console.log('****************************change w', w);
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
var workers = [];
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
    var worker = {};
    socket.emit('initWorker');

    socket.on('thermo', function (data) {
        //console.log('worker thermo*************************', JSON.stringify(data));
        var device = ko.utils.arrayFirst(devices, function (item) {
            return item.id === data.id;
        });


        if(!device) {
            console.log("************************couldn't find device", data.id);
            return;
        }

        //console.log('**********************thermo on worker', data.id, device.id, device.name);


        device.isHigh = data.isHigh;
        device.isLow = data.isLow;
        device.value = data.value;
        device.trigger = data.trigger;
        device.threshold = data.threshold;
        device.highThreshold = data.highThreshold;
        device.lowThreshold = data.lowThreshold;

        var found = ko.utils.arrayFilter(clients, function (client) {
            return client.session.isAuth && client.session.workers
                && ko.utils.arrayFirst(client.session.workers, function (item) {
                return item.workerId === device.workerId;
            });
        });

        ko.utils.arrayForEach(found, function (item) {
            item.socket.emit('thermo', {
                id: device.id,
                value: device.value,
                trigger: device.trigger,
                threshold: device.threshold,
                highThreshold: device.highThreshold,
                lowThreshold: device.lowThreshold,
                isHigh: device.isHigh,
                isLow: device.isLow
            });
        });
    });

    socket.on('change', function (data) {
        var device = ko.utils.arrayFirst(devices, function (item) {
            return item.id === data.id;
        });

        if(!device) {
            console.log("couldn't find device");
            return;
        }

        device.value = data.value;

        var found = ko.utils.arrayFilter(clients, function (client) {
            return client.session.isAuth
                && ko.utils.arrayFirst(client.session.workers, function (item) {
                return item.workerId === device.workerId;
            });
        });

        ko.utils.arrayForEach(found, function (item) {
            item.socket.emit('change', {
                id: device.id,
                value: device.value
            });
        });
    });

    socket.on('changeControlled', function (data) {
        var device = ko.utils.arrayFirst(devices, function (item) {
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

    socket.on('toggleControlled', function (data) {
        var device = ko.utils.arrayFirst(devices, function (item) {
            return item.id.toString() === data.id.toString()
        });
        //console.log('device', device);
        if(typeof device !== 'undefined' && device !== null) {
            var w = workers[device.socketId];

            if(w) {
                w.socket.emit('toggleControlled', data);
            }
        } else
            console.log("can't find device for id ", data.id);
    });

    socket.on('disconnect', function() {
        console.log('worker disconnect!');

        var toRemove = ko.utils.arrayFilter(devices, function (item) {
                return item.workerId === worker.workerId;
            }),
            toNotify = ko.utils.arrayFilter(clients, function (item) {
                return item.session.workerId === worker.workerId;
            });

        toRemove = ko.utils.arrayMap(toRemove, function (r) {
            return r.id;
        });

        ko.utils.arrayForEach(toNotify, function (item) {
            item.session.socket.emit('remove', toRemove);
        });

        devices = ko.utils.arrayFilter(devices, function (item) {
            return item.workerId !== worker.workerId;
        });
        ko.utils.arrayRemoveItem(workers, worker);
        worker = null;


    });

    socket.on('devices', function (data) {
        var found = ko.utils.arrayFilter(clients, function (client) {
            return client.session.isAuth && ko.utils.arrayFirst(client.session.workers, function (item) {
                return item.workerId === worker.workerId;
            });
        });

        ko.utils.arrayForEach(data, function (dev) {
            dev.setTrigger = function (trigger) {
                if(worker) {
                    dev.trigger = trigger;
                    worker.socket.emit('setTrigger', {id: dev.id, trigger: trigger});
                }
            };
            devices.push(dev);
            worker.devices.push(dev);
            ko.utils.arrayForEach(found, function (item) {
                item.socket.emit('add', [{
                    id: dev.id,
                    type: dev.type,
                    name: dev.name,
                    actionType: dev.actionType,
                    value: dev.value,
                    trigger: dev.trigger,
                    threshold: dev.threshold,
                    highThreshold: dev.highThreshold,
                    lowThreshold: dev.lowThreshold,
                    isHigh: dev.isHigh,
                    isLow: dev.isLow
                }]);
            });
        });



        if(found.length > 0)
            socket.emit('transmit', true);


    });

    socket.on('initWorker', function (data) {
        if(data.secret === globals.secret) {
            worker.socket = socket;
            worker.workerId = data.workerId;
            worker.devices = [];

            workers.push(worker);

            var found = ko.utils.arrayFilter(clients, function (client) {
                return client.session.isAuth && ko.utils.arrayFirst(client.session.workers, function (item) {
                    return item.workerId === worker.workerId;
                });
            });

            if(found.length > 0)
                socket.emit('transmit', true);

         db.devices.find({workerId: worker.workerId}, function (err, storeDevs) {
             if(err || storeDevs.length <= 0) {
                 storeDevs = data.devices;
             }

             var devs = ko.utils.arrayMap(storeDevs, function (dev) {
                 if(!dev.id || dev.id === 0)
                    dev.id = globals.guid();

                 console.log('*******id', dev.id);
                 dev.socketId = socket.id;
                 dev.workerId = worker.workerId;
                 dev.setTrigger = function (trigger) {
                     if(worker) {
                         dev.trigger = trigger;
                         worker.socket.emit('setTrigger', {id: dev.id, trigger: trigger});
                     }
                 };

                 return dev;
             });

             ko.utils.arrayForEach(devs, function (dev) {
                 if(dev.controls && dev.controls.length > 0) {
                     dev.controls = ko.utils.arrayMap(dev.controls, function (con) {
                         var first = ko.utils.arrayFirst(devs, function (f) {return f.pin === con.pin});
                         return {
                             workerId: worker.workerId,
                             id: first.id,
                             pin: con.pin,
                             type: con.type,
                             name: first.name
                         };
                     });
                 }

                 db.devices.save(dev, function (err, saved) {

                 });


             });


             //TODO: ???????????may need to be moved
             socket.emit('devices', devs);
         });

//            for(var ic = 0, ilc = clients.length; ic < ilc; ic++) {
//                clients[ic].emit('add', data.devices);
//            }
            //io.sockets.emit('refresh');
        }
    });
});

serverWorkers.listen(4131);