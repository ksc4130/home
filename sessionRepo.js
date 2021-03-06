module.exports = new function () {
    var self = this
        , _findSessionBySessId
        , globals = require('./globals')
        , bcrypt = require('bcrypt')
        , ko = require('knockout')
        , db = require("mongojs").connect(globals.dbUrl, globals.collections);


    _findSessionBySessId = function (sessId, cb) {
        db.userSessions.findOne(
            {sessId: sessId},
            function (err, found) {
                if(err)
                    console.error(err);

                cb(err, found);
            }
        );
    };

    self.update = function (session, cb) {
        cb = cb || function () {};
        if(!session.email) {
            cb('Must provide sessId in session object as first param to update session', null);
            return;
        }
        console.log('updating session', session);
        db.userSessions.update({sessId: session.sessId} , {$set: session}, cb);
    };

    self.save = function (session, cb) {
        cb = cb || function () {};
        if(!session.sessId) {
            cb('Must provide sessId in session object as first param to update session', null);
            return;
        }
        _findSessionBySessId(session.sessId, function (err, found) {
            if(!err && found) {
                console.log('updating session in save', session);
                delete session._id;
                db.userSessions.update({sessId: session.sessId} , {$set: session}, function (err, updated) {
                    console.log('updated session in save', session, err, updated);
                    cb(err, updated);
                });
            } else {
                db.userSessions.save(session, function (err, saved) {
                    if(err || !saved) {
                        cb(err, null);
                    } else {
                        console.log('saved new session in save', session);
                        _findSessionBySessId(session.sessId, cb);
                    }
                });
            }
        });

    };

    self.findBySessId = function (sessId, cb) {
        _findSessionBySessId(sessId, cb);
    };

//    self.create = function (session, cb) {
//        self.save(session,
//            function (err, saved) {
//                if(err)
//                    console.error(err);
//
//                cb(err, saved);
//            }
//        );
//    };

    return self;
};