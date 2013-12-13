var socket,
    vm,
    devices = [];

socket = io.connect(window.location.origin);

socket.on('init', function (data) {
    data.isInit= true;
    console.log('init', data);
    vm.set(data);
});

socket.on('change', function (data) {
    //console.log('change', data);
    for(var i = 0, il = devices.length; i < il; i++) {
        if(devices[i].id === data.id) {
            vm.set('devices[' + i + '].value', data.value);
            //(function (device) {
                //device.value = data.value;
            //}(devices[i]));
        }
    }
});

vm = new Ractive({
    el: '#content',
    template: '#tmpl',
    //noIntro: true, // disable transitions during initial render

    data: {
        isInit: false,
        isSignedIn: false,
        devices: devices,
        pin: '',
        remember: false,
        curThermo: {},
        login: {
           email: '',
           password: '',
           remember: false
        }
    }
});

vm.on('editThermo', function (e) {
    var d = e.context;


});

vm.on('toggle', function (e) {
    var d = e.context;

    socket.emit('change', {
        id: d.id,
        value: (1 - d.value)
    });
});

vm.on('login', function (e) {
    var d = e.context;

    socket.emit('login', d);
});

vm.on('register', function (e) {
    var d = e.context;

    socket.emit('register', d);
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
//$(function () {
//    $yup.modal({
//        show: false
//    });
//    ko.applyBindings(vm);
//});