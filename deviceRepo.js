module.exports = new function () {
    var self = this
        , _findDeviceById
        , globals = require('./globals')
        , bcrypt = require('bcrypt')
        , ko = require('knockout')
        , db = require("mongojs").connect(globals.dbName, globals.collections);


    _findDeviceById = function (id, cb) {
        db.devices.findOne(
            {id: id},
            function (err, found) {
                if(err)
                    console.error(err);

                cb(err, found);
            }
        );
    };

    self.findByWorkerId = function (workerId, cb) {
        db.devices.find(
            {workerId: workerId},
            function (err, found) {
                if(err)
                    console.error('error finding devices by workerId', err);

                cb(err, found);
            }
        );
    };

    self.update = function (device, cb) {
        cb = cb || function () {};
        if(!device.email) {
            cb('Must provide id in device object as first param to update device', null);
            return;
        }
        db.devices.update({id: device.id} , {$set: device}, cb);
    };

    self.save = function (device, cb) {
        cb = cb || function () {};
        if(!device.id) {
            cb('Must provide id in device object as first param to update device', null);
            return;
        }
        _findDeviceById(device.id, function (err, found) {
            if(!err && found) {
                delete device._id;
                db.devices.update({id: device.id} , {$set: device}, cb);
            } else {
                delete device._id;
                db.devices.save(device, function (err, saved) {
                    console.log('saved device saved._id:', saved._id, 'device._id', device._id);

                });
            }
        });

    };

    self.findById = function (id, cb) {
                console.log('hash', hash, password);
            _findDeviceById(id, cb);
    };

    self.create = function (device, cb) {
        self.save(device,
            function (err, saved) {
                if(err)
                    console.error(err);

                cb(err, saved);
            }
        );
    };

    return self;
};