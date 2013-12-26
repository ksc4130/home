module.exports = new function () {
    var self = this
        ,findUser
        , _findUserWithPass
        , _findUserByEmail
        , globals = require('./globals')
        , bcrypt = require('bcrypt')
        , ko = require('knockout')
        , db = require("mongojs").connect(globals.dbUrl, globals.collections);

    _findUserWithPass = function (email, password, cb) {
        bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash(password +  email + globals.secret, salt,  function(err, hash) {
                console.log('hash', hash, password);
                _findUserByEmail(email,
                    function (err, found) {
                        if(err)
                            console.error(err);
                        if(err || !found) {
                            cb(err, found);
                        }
                        else {
                            bcrypt.compare(password +  email + globals.secret, found.password, function(err, res) {
                                if(!res || err)
                                    found = null;
                                cb(err, found);
                            });
                        }
                    }
                );
            });
        });
    };

    _findUserByEmail = function (email, cb) {
        db.users.findOne(
            {email: email},
            function (err, found) {
                if(err)
                    console.error(err);

                cb(err, found);
            }
        );
    };

    self.update = function (user, cb) {
        cb = cb || function () {};
        if(!user.email) {
            cb('Must provide email in user object as first param to update user', null);
            return;
        }
        db.users.update({email: user.email} , {$set: user}, cb);
    };

    self.save = function (user, cb) {
        cb = cb || function () {};
        if(!user.email) {
            cb('Must provide email in user object as first param to update user', null);
            return;
        }
        _findUserByEmail(user.email, function (err, found) {
            if(!err && found) {
                db.users.update({email: user.email} , {$set: user}, cb);
            } else {
                db.users.save(user, cb);
            }
        });

    };

    self.findByEmail = function (email, cb) {
        _findUserByEmail(email, cb);
    };

    self.findByEmailAndPassword = function (email, password, cb) {
        _findUserWithPass(email, password, cb);
    };

    self.checkEmail = function (email, cb) {
        _findUserByEmail(email, cb);
    };

    self.create = function (user, cb) {
        bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash(user.password +  user.email + globals.secret, salt, function(err, hash) {
                user.password = hash;
                console.log('hash', hash, user.password);
                db.users.save(user,
                    function (err, saved) {
                        if(err)
                            console.error(err);

                        cb(err, saved);
                    }
                );
            });
        });
    };

    return self;
};