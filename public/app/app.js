var socket,
    vm,
    devices = [],
    filters,
    items;

socket = io.connect(window.location.origin);

ko.punches.enableAll();
//ko.punches.interpolationMarkup.enable();

ko.bindingHandlers.view = {
    preprocess: function (val, name, addCb) {
        addCb('if', "$root.curView() === '" + val + "'");
    }
};

ko.bindingHandlers.live = {
    preprocess: function (val, name, addCb) {
        addCb('valueUpdate', "'afterkeydown'");
        addCb('value', val);
    }
};

ko.bindingHandlers.datepicker = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        //initialize datepicker with some optional options
        var options = allBindingsAccessor().datepickerOptions || {};
        var v = ko.toJS(valueAccessor());
        $(element).datepicker(options);

        if(v)
            $(element).datepicker('update', v);

        //when a user changes the date, update the view model
        ko.utils.registerEventHandler(element, "changeDate", function(event) {
            var value = valueAccessor();
            if (ko.isObservable(value)) {
                value(event.date);
            }

        });
    },
    update: function(element, valueAccessor)   {
        var widget = $(element).data("datepicker");
        //when the view model is updated, update the widget
        if (widget) {
            widget.date = ko.utils.unwrapObservable(valueAccessor());
            if (widget.date) {
                widget.setValue();
            }
        }
    }
};

ko.validation.init({insertMessages: false});


var Vm = function () {
    var self = this;
    self.curFname = ko.observable();
    self.view = ko.observable();
    self.curView = ko.observable();

    self.devices = ko.observableArray([]);
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

    var isReg = function() { return self.curView() === 'register'; };

    self.loginModel = {
        email: ko.observable().extend({email: true, required: true}),
        password: ko.observable(),
        confirmPassword: ko.observable().extend({ required: { onlyIf: function() { return self.curView() === 'register'; }}
            ,equal: self.password }),
        fname: ko.observable().extend({ required: { onlyIf: isReg}}),
        lname: ko.observable().extend({ required: { onlyIf: isReg}}),
        dob: ko.observable(new Date('9/15/1986')).extend({ required: { onlyIf: isReg}, date: true}),
        remember: ko.observable(false),
        isAuth: ko.observable(false),
        error: ko.observable()
    };

    self.workerModel = {
        name: ko.observable(),
        workerId: ko.observable(),
        error: ko.observable()
    };

    self.workers = ko.observableArray([]);

    self.addWorker = function () {
        socket.emit('addWorker', ko.toJS(self.workerModel), function (err, data) {
            if(!err && data)
                self.workers.push(data);
        });
    };

    self.loginModel.passwordsDontMatch = ko.computed(function () {
        return this.password() !== this.confirmPassword()
    }, self.loginModel).extend({throttle: 250});

    self.login = function (d) {
        console.log(ko.toJS(d));
        socket.emit('login', ko.toJS(self.loginModel), function (err, loginModel) {
            console.log('login cb', loginModel);
            self.loginModel.isAuth(loginModel.isAuth);
            self.loginModel.error(loginModel.error);
            if(loginModel.isAuth) {
                location.hash = 'home';
                self.loginModel.password('');
                if(!self.loginModel.remember()) {
                    self.loginModel.email('');
                }
            }
        });
    };

    self.logoff = function () {
        socket.emit('logoff', function (data) {
            if(data) {
                self.loginModel.email(null);
                self.loginModel.fname(null);
                self.loginModel.lname(null);
                self.loginModel.remember(null);
                self.loginModel.isAuth(null);
                self.loginModel.error(null);
                self.loginModel.dob(null);
            }
        });
    };

    self.register = function (d) {

        var model = vm.loginModel;
        if(!model.email.isValid()) {
            model.error("Please check email is valid.");
            return;
        }
        if(model.passwordsDontMatch()) {
            model.error("Passwords don't match");
            return;
        }
        if(!model.fname.isValid()) {
            model.error("First name is required.");
            return;
        }
        if(!model.lname.isValid()) {
            model.error("Last name is required.");
            return;
        }
        if(!model.dob.isValid()) {
            model.error("Please check birth date is valid.");
            return;
        }
        socket.emit('register', ko.toJS(model), function (err, loginModel) {
            console.log('login cb', loginModel);
            model.isAuth(loginModel.isAuth);
            model.error(loginModel.error);
            if(loginModel.isAuth) {
                location.hash = 'home';
                model.password('');
                model.confirmPassword('');
                if(!loginModel.remember) {
                    model.email('');
                }
            }
        });
    };

    self.routeCheck = ko.computed(function () {
        var view = self.curView(),
            isAuth = self.loginModel.isAuth();
        console.log(isAuth, view);
        if(view && view !== 'login' && view !== 'register' && !isAuth) {
            location.hash = 'login';
        }
    });

    return self;
};


function addDevice(dev) {
    dev.value = ko.observable(dev.value);
    if(dev.actionType === 'thermo') {
        dev.trigger = ko.observable(dev.trigger);
        dev.highTheshold = ko.observable(dev.highTheshold);
        dev.lowThreshold = ko.observable(dev.lowThreshold);
        dev.isHigh = ko.observable(dev.isHigh);
        dev.isLow = ko.observable(dev.isLow);
    }

    vm.devices.push(dev);
}

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
            vm.devices.remove(function (item) {
                return item.id === data[i];
            });
        }
    }
});

socket.on('change', function (data) {
    console.log('change');
    ko.utils.arrayForEach(vm.devices(), function (item) {
        if(data.id === item.id) {
            console.log('change', data.id, item.id, item.value(), data.value);
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

socket.on('init', function (data) {
    console.log('init', data);
    vm.loginModel.isAuth(data.isAuth);
    vm.loginModel.remember(data.remember);
    vm.loginModel.email(data.email);
    vm.loginModel.fname(data.fname);
    vm.loginModel.lname(data.lname);
    vm.loginModel.dob(data.dob || new Date('9/15/1986'));
    if(data.isAuth)
        location.hash = 'home';
    else
        location.hash = 'login';

    vm.devices([]);
    data = data || {};
    if(data.devices && data.devices.length > 0) {
        for(var i = 0, il = data.devices.length; i < il; i++) {
            addDevice(data.devices[i]);
        }
    }
    $('#content').show();
});


vm = new Vm();
var routes = {
    '/:view': vm.curView
};
var router = Router(routes);
router.init();

$(function () {
    ko.applyBindings(vm);
});

