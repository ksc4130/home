var socket = io.connect(window.location.origin);

var device = function (args) {

    var self = new function() {};

    args = args || {};

    self.id = args.id;
    self.name = args.name || 'unknown';
    self.value = ko.observable(args.value || 0);
    self.type = args.type || 'light';
    self.actionType = args.actionType || 'onoff';

    self.isOn = ko.computed(function () {
        return self.value() === 1;
    });

    self.isOff = ko.computed(function () {
        return self.value() === 0;
    });

    self.toggle = function () {
        socket.emit('change', {
            sId: self.sId,
            id: self.id,
            value: (1 - self.value())
        });
    };

    return self;
};
var $yup = $('#yup');
var vm = new function () {
    var self = this;
    self.devices = ko.observableArray([]);
    self.pin = ko.observable();
    self.remember = ko.observable();

    self.yup = function () {
        $yup.modal('hide');
        //$(document).unbind('keyup', yupEnterBinding);
        socket.emit('yup', {
            pin: self.pin(),
            remember: self.remember()
        });
    };
};
socket.on('yup', function (data) {
    if(!data) {
        $yup.modal('show');
    }
});

socket.on('init', function (data) {
    var mapped = ko.utils.arrayMap(data, function (item) {
        return device(item);
    });
    vm.pin(undefined);
    vm.devices(mapped);

    $('#content').show();
});

socket.on('remove', function (data) {
    var arr = vm.devices(),
        nArr,
        isArr = (data instanceof Array);

    nArr = ko.utils.arrayFilter(arr, function (item) {
        return (isArr && data.indexOf(item.id) <= -1) || (!isArr && data.id !== item.id);
    });
    vm.devices(nArr);
});

socket.on('add', function (data) {
    ko.utils.arrayForEach(data, function (item) {
        vm.devices.push(device(item));
    });
});

socket.on('change', function (data) {
    var arr = vm.devices(),
        device = ko.utils.arrayFirst(arr, function (item) {
            return item.id === data.id;
        });
    if(device)
        device.value(data.value);
});

$(function () {
    $yup.modal({
        show: false
    });
    ko.applyBindings(vm);
});