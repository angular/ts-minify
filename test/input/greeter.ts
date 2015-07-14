class Greeter {
	greeting: string;
	name: string;

	constructor(g, n) { 
		this.greeting = g;
		this.name = n;
	}
	greet() {
		return "<h1>" + this.name + "says: " + this.greeting + "</h1>";
	}
}

var aGreeter: Greeter = new Greeter("Hello, world!", "daria");

aGreeter.name;
aGreeter.greeting;