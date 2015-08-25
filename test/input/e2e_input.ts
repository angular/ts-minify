import * as assert from 'assert';

class Animal {
	name: string;
	constructor(n: string) { this.name = n; }
}

function main() {
	var animal = new Animal('cat');
	return animal.name;
}

assert.equal(main(), 'cat');
console.log('e2e_input.ts: Assertion Passed');