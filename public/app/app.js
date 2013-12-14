var socket,
    vm,
    devices = [];

socket = io.connect(window.location.origin);

vm = (new function () {
    var self = this;

    self.isInit = ko.observable(false);
    self.isSignedIn = ko.observable(false);
    self.devices = ko.observableArray([]);
    self.login = {
        email: ko.observable(),
        password: ko.observable(),
        remember: ko.observable()
    };
    self.curThermo = ko.observable();

    self.editThermo = function (d) {
        self.curThermo(d);
        $('#thermoEdit').modal('show');
    };

    self.setTrigger = function (d) {
        socket.emit('setTrigger', ko.toJS(self.curThermo));
        $('#thermoEdit').modal('hide');
    };

    self.toggle = function (d) {
        console.log({
            id: d.id,
            value: (1 - d.value())
        });
        socket.emit('change', {
            id: d.id,
            value: (1 - d.value())
        });
    };

    self.login = function () {
        socket.emit('login', ko.toJS(d));
        self.login.password('');
    };

    self.register = function (d) {
        socket.emit('register', ko.toJS(d));
    };
});

function addDevice(dev) {
    dev.value = ko.observable(dev.value);
    if(devices[i].actionType === 'thermo') {
        dev.trigger = ko.observable(dev.trigger);
        dev.isHeat = ko.observable(dev.isHeat);
        dev.isCool = ko.observable(dev.isCool);
    }

    devices.push(dev);
}

socket.on('init', function (data) {
    console.log('init', data);
    data = data || {};
    vm.isSignedIn(data.isSignedIn);
    vm.isInit(true);
    if(data.devices && data.devices.length > 0) {
        for(var i = 0, il = data.devices.length; i < il; i++) {
            addDevice(data.devices[i]);
        }
    }
});

socket.on('add', function (data) {
    console.log('add', data);
    if(data && data.length > 0) {
        for(var i = 0, il = data.length; i < il; i++) {
            addDevice(data[i]);
        }
    }
});

socket.on('remove', function (data) {
    console.log('remove', data);
    if(data && data.length > 0) {
        for(var i = 0, il = data.length; i < il; i++) {
            for(var id = 0, ild = devices.length; id < ild; id++) {
                if(devices[id] && devices[id].id === data[i]) {
                    devices.splice(id, 1);
                }
            }
        }
    }
});

socket.on('change', function (data) {
    ko.utils.arrayForEach(vm.devices(), function (item) {
        if(data.id === item.id) {
            item.value(data.value);
        }
    });
});

socket.on('thermo', function (data) {
    ko.utils.arrayForEach(vm.devices(), function (item) {
        if(data.id === item.id) {
            item.value(data.value);
            item.isCool(data.isCool);
            item.isHeat(data.isHeat);
            item.trigger(data.trigger);
        }
    });
});

$(function () {
    ko.applyBindings(vm);
});

//var device = function (args) {
//
//    var self = new function() {};
//
//    args = args || {};
//
//    self.id = args.id;
//    self.name = args.name || 'unknown';
//    self.value = ko.observable(args.value || 0);
//    self.isCool = ko.observable(args.isCool || false);
//    self.isHeat = ko.observable(args.isHeat || false);
//    self.trigger = ko.observable(args.trigger || false);
//    self.highThreshold = ko.observable(args.highThreshold || false);
//    self.lowThreshold = ko.observable(args.highThreshold || false);
//    self.type = args.type || 'light';
//    self.actionType = args.actionType || 'onoff';
//
//    self.isOn = ko.computed(function () {
//        return self.value() === 1;
//    });
//
//    self.isOff = ko.computed(function () {
//        return self.value() === 0;
//    });
//
//    self.toggle = function () {
//        socket.emit('change', {
//            sId: self.sId,
//            id: self.id,
//            value: (1 - self.value())
//        });
//    };
//
//    self.setTrigger = function (d) {
//        socket.emit('setTrigger', {
//            id: self.id,
//            trigger: self.trigger()
//        });
//        $('#thermoEdit').modal('hide');
//    };
//
//    return self;
//};
//var $yup = $('#yup');
//var vm = new function () {
//    var self = this;
//    self.devices = ko.observableArray([]);
//    self.pin = ko.observable();
//    self.remember = ko.observable();
//    self.curThermo = ko.observable();
//
//    self.yup = function () {
//        $yup.modal('hide');
//        //$(document).unbind('keyup', yupEnterBinding);
//        socket.emit('yup', {
//            pin: self.pin(),
//            remember: self.remember()
//        });
//    };
//
//    self.editThermo = function (d) {
//        self.curThermo(d);
//        $('#thermoEdit').modal('show');
//    };
//};

//socket.on('yup', function (data) {
//    if(!data) {
//        $yup.modal('show');
//    }
//});
//
//socket.on('init', function (data) {
//    var mapped = ko.utils.arrayMap(data, function (item) {
//        return device(item);
//    });
//    vm.pin(undefined);
//    vm.devices(mapped);
//
//    $('#content').show();
//});
//
//socket.on('remove', function (data) {
//    var arr = vm.devices(),
//        nArr,
//        isArr = (data instanceof Array);
//
//    nArr = ko.utils.arrayFilter(arr, function (item) {
//        return (isArr && data.indexOf(item.id) <= -1) || (!isArr && data.id !== item.id);
//    });
//    vm.devices(nArr);
//});
//
//socket.on('add', function (data) {
//    ko.utils.arrayForEach(data, function (item) {
//        vm.devices.push(device(item));
//    });
//});
//
//socket.on('change', function (data) {
//    //console.log('change', data);
//    var arr = vm.devices(),
//        device = ko.utils.arrayFirst(arr, function (item) {
//            return item.id === data.id;
//        });
//    //console.log(data.value);
//    if(device)
//        device.value(data.value);
//});
//
//socket.on('thermo', function (data) {
//    console.log('thermo', data);
//    var arr = vm.devices(),
//        device = ko.utils.arrayFirst(arr, function (item) {
//            return item.id === data.id;
//        });
//    if(device) {
//        device.isCool(data.isCool);
//        device.isHeat(data.isHeat);
//        device.value(data.value);
//    }
//});
//
