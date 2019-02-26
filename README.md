# TS-Minify (Experimental) [![Build Status](https://travis-ci.org/angular/ts-minify.svg)](https://travis-ci.org/angular/ts-minify)

### About

---
TS-Minify is tool to aid in the reduction of code size for programs written in the [TypeScript](http://www.typescriptlang.org/) language. It is currently **highly experimental**.

This tool is developed on TypeScript and NodeJS, and transpiled to ES5; it uses the CommonJS module system.

**There is currently no CLI or build-tool integration for TS-Minify.**

### Table of Contents

----------

- [Motivation](#motivation)
- [What it Does](#what-it-does)
- [How Does it Work? The TL;DR](#how-does-it-work-the-tldr)
- [External vs. Internal Types](#external-vs-internal-types)
- [Structural Typing](#structural-typing)
- [Usage](#usage)
- [TSConfig Users](#tsconfig-users)
- [Scope of Minification](#scope-of-minification)
- [Caveats/Warnings](#caveatswarnings)
- [Sample Measurements](#sample-measurements)
- [Contributing](#contributing)
- [Contributors](#contributors)
- [License: Apache 2.0](#license-apache-20)
- [Future](#future)

### Motivation

---
Angular 2 (which is written in TypeScript) currently sits at around 135kb after being [Uglified](https://github.com/mishoo/UglifyJS) and compressed through GZIP. In comparison, Angular 1.4 is about 50kb, minified and compressed.

A smaller bundle size means that less data needs to be transferred and loaded by the browser. This contributes to a better user experience.

The impetus for this tool was to reduce the code size of the Angular 2 bundle, but TS-Minify is meant to be a generic tool that can be used on programs written in TypeScript.


### What it Does

---
To achieve code size reduction, TS-Minify uses the idea of property renaming: take a TypeScript source file and rename properties to shorter property names, then re-emit the file as valid TypeScript.

![TS-Minify role in minification pipeline](http://i.imgur.com/7iH4RyF.png) <sub>This diagram demonstrates TS-Minify's role in the intended minification pipeline.</sub>

TS-Minify *only*  targets property renaming. Minification tactics like whitespace removal, dead code removal, variable name mangling, etc. are taken care of by tools such as [UglifyJS](https://github.com/mishoo/UglifyJS). TS-Minify specifically targets property renaming since it is something that is difficult to achieve *safely* without type information. As such, TS-Minify requires a program to be correctly and throughly typed, otherwise, unwanted renaming may occur. 

### How Does it Work? The TL;DR

---
The TypeScript Compiler API is utilized in order to access the Abstract Syntax Tree of a TypeScript source file. Identifiers that might be considered properties (such as identifiers in property declarations, property access expressions, method names in method declarations, etc.) are renamed to short names such as `a`, `b`, etc. after determining their renaming eligibility. A “renaming” global map is created with mappings from the original property name to the new generated property name so that re-namings are kept consistent between properties with the same names.

```javascript
{ maybeHandleCall: g }
{ reportMissingType: h }
{ getHandler: i }
{ handlePropertyAccess: j }
{ emitExtraImports: k }
{ emit: l }
{ visitTypeName: m }
```
<sub>An example of some mappings from the original property name to the shorter, generated property name.</sub>

The renaming eligibility of a property takes several factors into consideration:

- Does the property belong to an object declared in an external file ([`.d.ts file`](http://definitelytyped.org/))?
- Does the property belong to a [standard built-in object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects)?
- Does the property name belong to the DOM?

### External vs. Internal Types

---
TS-Minify is able to safely rename properties by understanding which types are *external*, and which are not, to one's program.

An *external* type is something that you are bringing into your program. It is a type which you have not defined. This includes objects and functions from the JavaScript standard library, and JavaScript libraries like underscore.js or jQuery. If you are using external libraries, it is imperative that you include their corresponding `.d.ts` files.

Typings for the standard library are included in the default library typings, `lib.d.ts`, which the TypeScript compiler uses during transpilation (it will typecheck your program at compile time) and does not need to be explicitly included.

*Internal* types are ones that you, the programmer, have defined yourselves. Declaring a class `Foo` in your program tells the minifier that properties on `Foo` objects are within the renaming scope. Internal types also include things like object literal types.

**Note**: If you want all internal sources to contain the same renamings, you should pass the relevant files together through a single pass of the minifier.

An example of what types are considered *external* and *internal*:

```javascript
var x: { name: string, message: string }; // The object literal is an internal type

var x: Error; // Error is an external type

// Structurally, the two are compatible, which brings us to the next section...
```

### Structural Typing

---
TypeScript uses a [structural type system](https://en.wikipedia.org/wiki/Structural_type_system). This means that objects and variables can be casted from one type to another as long as they are structurally compatible. Sometimes this means that external objects might be casted to internal objects, or vise versa.

Here is an example of an external type being casted to an internal type:

```javascript
function x(foo: { name: string, message: string }) {
	foo.name;
	return foo; 
} 

x(new Error());
```

Function `x` *expects* an internal object literal type. The call site `x(new Error())` passes an `Error` object as the parameter.

[`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) is an object in the JavaScript standard library. Hence it is external to our small program above. Structurally, an `Error` object and the object literal `{ name: string, message: string }` are compatible. However, this means that we do not want to rename the properties on the object literal because we will likely want to access the properties of the `Error` object as we know them: `name` and `message`. If we renamed the properties of the object literal, it means that if an `Error` object is passed into a function call for `x()`, `foo.$some_renaming` will throw an error, because `Error` does not have property `$some_renaming`. 

Here is an example of an internal type being coerced into an external type:

```javascript
function ff(e: Error) { 
	return e.name; 
} 

ff({ name: null, message: null });
```

The parameter `e` on function `ff` is an external type to our program. We do not want to rename its properties. At the function call site, we are passing in an object literal type with properties `name` and `message`, which is structurally compatible with `Error`. We do not want to rename properties in the object literal because we need to coerce it into an external typing, which is expected to have properties `name` and `message`.

All of this is to say, the tool relies on type information to figure out if two types can be coerced into each other and whether their properties can be renamed based on the internal/external distinction. Type your programs! :)

### Usage

--- 

First clone the repo and run `npm install`.

```shell
$ git clone git@github.com:angular/ts-minify.git
$ cd ts-minify
$ npm install
```

Create a new TypeScript file:

```javascript
import {Minifier, options} from './src/main';
var minifier = new Minifier();
minifier.renameProgram(['path/to/file.ts', 'path/to/another/file.ts', 'some/other/file.d.ts'], 'path/to/destination');
```

Transpile the above script into JavaScript using the TypeScript compiler and run it with Node:

```shell
tsc --module commonjs script.ts
node script.js
```

A new instance of the minifier takes an optional constructor argument:

```javascript
MinifierOptions {
  failFast?: boolean;
  basePath?: string;
}
```

`failFast`: Setting `failFast` to true will throw an error when the minifier hits one.

`basePath`:  Specifies the base path that the minifier uses to figure out to where to write the minfied TypeScript file. The `basePath` maybe be relative or absolute. All paths are resolved from the directory in which the minifier is executed. If there is no base path, the minified TypeScript file is outputted to the specified destination using a flattened file structure.

`minifier.renameProgram()` takes a list of file names and an optional destination path:

```javascript
renameProgram(fileNames: string[], destination?: string)
```

`renameProgram` accepts TypeScript files and `.d.ts` files. If you are not explicitly including typings using the reference path syntax in your TypeScript file, please pass in the `.d.ts` file so that the minifier can use the type information.

The minifier will uniformly rename the properties (which are available for renaming) across all the files that were passed in.

### TSConfig Users

---
If you are using a `tsconfig.json` file to reference your type definitions, pass in the `.d.ts` files for libraries used in your program to the minifier so that it can reference the type information for property renaming. The minfier does not have access to the `tsconfig.json` file. Otherwise, make sure to have `/// <reference path = 'foo.d.ts' />` at the top of your programs if you are using any external libraries.

### Scope of Minification

---
Currently, TS-Minify will do property renaming throughout all the files that are passed into it. The minifier excludes `.d.ts` files from renaming because those are the typing definitions of external libraries. If your TypeScript program exports objects across those files, the minifier will rename them uniformly in their declarations and their usage sites.

### Caveats/Warnings

---
In order to get the most out of the minifier, it is recommended that the user types their program as specifically and thoroughly as possible. In general, you should  avoid using the `any` type, and implicit `any`s in your code as this might result in unwanted naming.  

We recommend that you compile your TypeScript program with the  `noImplicitAny` compiler flag enabled before trying the minifier.

Please avoid explicit any casting: 

```javascript
// example of explicit any casting
var x = 7; 
<any>x;
```

### Sample Measurements

---
TS-Minify was run on a well-typed TypeScript program with the following stats and results:

- Approximately 2100 lines of code (split across 10 files)
- Unminified and Uglified: 72kb
- Minified and Uglified: 56kb (codesize reduction of about 20%)
- About 6% - 8% codesize reduction after minification, Uglification, and GZIP compression.

### Contributing

---
Clone the repository from GitHub:

```shell
$ git clone git@github.com:angular/ts-minify.git
$ cd ts-minify
$ npm install
```

Run the unit tests with `gulp unit.test`

Run the end-to-end tests with `gulp e2e.test`.

This project uses `clang-format`. Run `gulp test.check-format` to make sure code you write conforms to this standard.

- If you need some guidance on understanding TypeScript, look at the [TypeScript GitHub Wiki](https://github.com/Microsoft/TypeScript/wiki).
- If you need a quick introduction to the TS Compiler API, take a look at the page on using the [TS Compiler](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API) API. 
- Take a look at the `typescript.d.ts` for type signatures, and to understand what is available to you from the TS toolchain.

If you need some help debugging, there is a  `DEBUG` flag that can be enabled in `src/main.ts`:

```javascript
const DEBUG = true; // switch from false to true to enable the console.logs
```

There are some helpful print statements which print out: 

- the `SyntaxKind` of the nodes being traversed
- the minified string output
- a dictionary of external/internal type casts

Remember to switch the `DEBUG` flag off afterwards.

### Contributors

---
Daria Jung (Google intern)


### License: Apache 2.0

---
```
Copyright 2015 Google, Inc. http://angular.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
### Future

---

Property renaming is hard and there are a lot of [issues](https://github.com/angular/ts-minify/issues)! If you're interesting in contributing to this project, please check some of them out.

Issues are labelled `easy`, `medium`, and `hard`. Some have a `Needs Exploration` label which means you might have to poke around a bit before reaching conclusions about how to tackle the problem!

