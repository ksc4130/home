var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

WorkerProvider = function(host, port) {
    this.db= new Db('node-mongo-worker', new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
    this.db.open(function(){});
};


WorkerProvider.prototype.getCollection= function(callback) {
    this.db.collection('workers', function(error, worker_collection) {
        if( error ) callback(error);
        else callback(null, worker_collection);
    });
};

//find all workers
WorkerProvider.prototype.findAll = function(callback) {
    this.getCollection(function(error, worker_collection) {
        if( error ) callback(error)
        else {
            worker_collection.find().toArray(function(error, results) {
                if( error ) callback(error)
                else callback(null, results)
            });
        }
    });
};

WorkerProvider.prototype.find = function(filterObj, callback) {
    this.getCollection(function(error, worker_collection) {
        if( error ) callback(error)
        else {
            worker_collection.find(filterObj || {}).toArray(function(error, results) {
                if( error ) callback(error)
                else callback(null, results)
            });
        }
    });
};

WorkerProvider.prototype.findById = function(id, callback) {
    if(!id)
        return null;

    this.getCollection(function(error, worker_collection) {
        if( error ) callback(error);
        else {
            worker_collection.findOne({'_id':new ObjectID(id)}).toArray(function(err, item) {
                console.dir(item);
                // Let's close the db
                db.close();
                callback(null, item);
            });
        }
    });
};

//save new worker
WorkerProvider.prototype.save = function(workers, callback) {
    this.getCollection(function(error, worker_collection) {
        if( error ) callback(error)
        else {
            if( typeof(workers.length)=="undefined")
                workers = [workers];

            for( var i =0;i< workers.length;i++ ) {
                worker = workers[i];
                worker.createdOn = new Date();
            }

            worker_collection.insert(workers, function() {
                callback(null, workers);
            });
        }
    });
};

exports.WorkerProvider = WorkerProvider;