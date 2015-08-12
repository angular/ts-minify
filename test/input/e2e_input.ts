/// <reference path='../../typings/node/node.d.ts'/>

import * as assert from 'assert';

class Animal {
	name: string;
	constructor(n: string) {
		this.name = n;
	}
}

function main() {
	var animal = new Animal('cat');
	return animal.name;
}

assert.equal(main(), 'cat');
console.log('assertion passed');