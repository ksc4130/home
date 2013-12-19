module.exports = new function () {
    var self = this
        ,findUser
        , createUser
        , checkEmail
        , globals = require('./globals')
        , bcrypt = require('bcrypt')
        , ko = require('knockout')
        , db = require("mongojs").connect(globals.dbName, globals.collections);

    findUser = function (email, password, cb) {
        bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash(password +  email + globals.secret, salt,  function(err, hash) {
                console.log('hash', hash, password);
                checkEmail(email,
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

    checkEmail = function (email, cb) {
        db.users.findOne(
            {email: email},
            function (err, found) {
                if(err)
                    console.error(err);

                cb(err, found);
            }
        );
    };

    createUser = function (user, cb) {
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

    self.findUser = findUser;
    self.createUser = createUser;
    self.checkEmail = checkEmail;
    return self;
};