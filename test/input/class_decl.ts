class Greeter {
  greeting: string;
  constructor(message: string) { this.greeting = message; }
  greet() { return 'Hello, ' + this.greeting; }
}

var greeter = new Greeter('world');