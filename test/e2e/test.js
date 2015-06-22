var assert = require('assert')
describe('Hello World', function(){
	it('The first char of "Hello World" should be "H"', function(){
		assert.equal('H', "Hello World"[0]);
	})
})