var Greeter = (function () {
    function Greeter(greeting, name) {
        this.greeting = greeting;
        this.name = name;
    }
    Greeter.prototype.greet = function () {
        return "<h1>" + this.name + "says: " + this.greeting + "</h1>";
    };
    return Greeter;
})();
;
var greeter = new Greeter("Hello, world!", "daria");
var str = greeter.greet();
document.body.innerHTML = str;
