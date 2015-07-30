// class Animal {
//     name:string;
//     constructor(theName: string) { this.name = theName; }
//     move(meters: number = 0) {
//         alert(this.name + " moved " + meters + "m.");
//     }
// }
// var cat = new Animal('kitkat');
// console.log(cat.name);
var $ = (function () {
    function $(a) {
        this._ = a;
    }
    $.prototype.b = function (c) {
        if (c === void 0) { c = 0; }
        alert(this._ + " moved " + c + "m.");
    };
    return $;
})();
var e = new $('kitkat');
console.log(e._);
