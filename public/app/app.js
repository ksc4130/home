var socket = io.connect(window.location.origin);

var device = function (args) {

    var self = new function() {};

    args = args || {};

    self.id = args.id;
    self.name = args.name || 'unknown';
    self.state = ko.observable(args.state || 0);
    self.type = args.type || 'light';
    self.actionType = args.actionType || 'onoff';

    self.isOn = ko.computed(function () {
        return self.state() === 1;
    });

    self.isOff = ko.computed(function () {
        return self.state() === 0;
    });

    self.toggle = function () {
        socket.emit('change', {
            sId: self.sId,
            id: self.id,
            state: (1 - self.state())
        });
    };

    return self;
};
var $yup = $('#yup');
var vm = new function () {
    var self = this;
    self.barn = ko.observableArray([]);
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
    vm.barn(mapped);

    $('#content').show();
});

socket.on('remove', function (id) {
    var arr = vm.barn(),
        device = ko.utils.arrayFirst(arr, function (item) {
            return item.id === id;
        });
    if(device)
        vm.barn.remove(device);
});

socket.on('change', function (data) {
    //console.log('change', data);
    var arr = vm.barn(),
        device = ko.utils.arrayFirst(arr, function (item) {
            return item.id === data.id;
        });
    if(device)
        device.state(data.state);
});

$(function () {
    $yup.modal({
        show: false
    });
    ko.applyBindings(vm);
});