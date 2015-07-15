class Greeter {
	greeting: string;
	name: string;

	constructor(public greeting: string, public name: string) { 
		this.greeting = greeting;
		this.name = name;
	}
	greet() {
		return "<h1>" + this.name + "says: " + this.greeting + "</h1>";
	}
};
var greeter: Greeter = new Greeter("Hello, world!", "daria");
var str = greeter.greet();

document.body.innerHTML.fontsize = 7;

var hello;


// document . body . innerHTML 