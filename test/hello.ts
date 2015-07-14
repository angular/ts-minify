class Greeter {
    constructor(public greeting: string, public name: string) { 
    }
    greet() {
        return "<h1>" + this.name + "says: " + this.greeting + "</h1>";
    }
};
var greeter: Greeter = new Greeter("Hello, world!", "daria");
var str = greeter.greet();
document.body.innerHTML = str;

