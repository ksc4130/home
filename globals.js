module.exports = (new function () {
    var self = this;
    self.secret = 'sec';
    self.dbName = 'kyngster';
    self.collections = ['users', 'userSessions'];
    return self;
});