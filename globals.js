module.exports = (new function () {
    var self = this;
    self.secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';
    self.dbName = 'kyngster';
    self.dbUrl = 'dbUser:Lala!!4130@localhost/' + self.dbName;
    self.collections = ['users', 'userSessions', 'devices', 'workers'];
    self.guid = function () {
        var d = new Date().getTime();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x7|0x8)).toString(16);
        });
    };
    return self;
});