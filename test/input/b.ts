import a = require('./a');
var foo = new a.Foo();
foo.bar = 'bar';
console.log('This should be bar: ' + foo.bar);