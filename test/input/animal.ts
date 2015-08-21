/// <reference path='../../typings/node/node.d.ts'/>

class Animal {
	//name: string;
	constructor(public name: string) {  
		console.log(this.name);
	}
	//constructor(theName: string) { this.name = theName; } ;
	move(meters: number = 0) { alert(this.name + " moved " + meters + "m."); }
}

var cat: Animal = new Animal('kitkat');
cat.move();
console.log(cat.name);
