# TS-Minify (Work in Progress)

A TypeScript to TypeScript transpiler for property renaming based on type information. 


#### Roadmap
- Try renaming things without keeping track of what it belongs to.
- Ignore things like document.getElementByID (things that cannot be renamed)
- Never want to construct the entire string
- Do we care about types? Care more about the symbol information? 
- get the stupid renaming going --> get more clever renaming going

#### References
- [TS2Dart](https://github.com/angular/ts2dart)
- [Investigating the TypeScript Compiler API](http://blog.scottlogic.com/2015/01/20/typescript-compiler-api.html)
- [Using the Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API)

#### License
Apache 2.0