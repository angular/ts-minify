///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/typescript/typescript.d.ts"/>

import ts = require('typescript');
var fs = require('fs'); // filesystem module
var util = require('util');
var path = require('path');

/* TranspilerOptions Class will go here */

class PropertyInfo {
  private lhs: string;
  private newName: string;

  constructor(lhs: string, newName: string) {
    this.lhs = lhs;
    this.newName = newName;
  }

  getLHS(): string {
    return this.lhs;
  }

  getNewName(): string {
    return this.newName;
  }
}

/* The Transpiler Class */
export class Renamer {
  private output: string; // for now, what is an output object?
  private currentFile: ts.SourceFile;

  /* 
   * List of properties, and their remappings. Property has what type its parent is (left hand side
   * expression) and its new name. 
   */
  renameMap = new Map();
  /* 
   * List of "root" names, and the last property name assigned to one of its properties.
   * ie: Foo is a class. Foo has properties x, y, z which were renamed to a, b, c. 
   * { Foo: 'c' } allows easy access to Foo's last renamed property so we can use 
   * getNextLateralPropertyName per Class, not globally. 
   */
  prevNameMap = new Map();

  /* Not sure if needed */
  nodes: ts.Node[] = [];

  /* Not needed as of now */
  private errors: string[] = [];


  constructor() {
    /* nothing here yet */
  } 

  compile(fileNames: string[], options: ts.CompilerOptions): void {
    var program = ts.createProgram(fileNames, options);
    var emitResult = program.emit();

    var allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
      var loc = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(
        '${diagnostic.file.fileName} (${loc.line + 1},${loc.character + 1}): ${message}'
      );
    });

    var exitCode = emitResult.emitSkipped ? 1 : 0;
    console.log("Process exiting with code '${exitCode}'.");
    process.exit(exitCode);
  }

  /* NoEmitOnError is a bit silly given the current situation */
  callCompile() {
    this.compile(process.argv.slice(2), {
      noEmitOnError: true, noImplicitAny: true,
      target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
    });
  }

  /* return set options for the compiler */
  getCompilerOptions(): ts.CompilerOptions {
    const options: ts.CompilerOptions = {
      allowNonTsExtensions: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES6,
    };
    return options;
  }

  /* Create a Transpiler Class */
  createCompilerHost(fileNames: string[], options?: ts.CompilerOptions): ts.CompilerHost {
    // why is this needed? rather, what is the point?
    var fileMap: { [s: string]: boolean } = {};
    fileNames.forEach((f) => fileMap[f] = true); // why?

    // sanity check that given files actually exist
    // fileNames.forEach((fpath) => {
    //  fs.exists(fpath, function(exists) {
    //      console.log(exists ? "exists" : "nope :(");
    //  });
    // });

    /* the methods of a compiler host object */
    return {
      getSourceFile: (sourceName, languageVersion) => {
        if (fileMap.hasOwnProperty(sourceName)) {
          console.log('hello?');
          console.log(sourceName);
          var contents = fs.readFileSync(sourceName, 'UTF-8');
          console.log("==========================================================");
          console.log(contents);
          console.log("==========================================================");
          return ts.createSourceFile(sourceName, contents, 
              this.getCompilerOptions().target, true);
        } 
        if (sourceName === "lib.d.ts")
          return ts.createSourceFile(sourceName, '', this.getCompilerOptions().target, true);
        return undefined;
      },
      // these are not used; just exist to satisfy interface?
      writeFile: function(name, text, writeByteOrderMark, outputs) {
        fs.writeFile(name, text);
      },
      getDefaultLibFileName: function() { return "lib.d.ts"; },
      useCaseSensitiveFileNames: function() { return true; },
      getCanonicalFileName: function(filename) { return filename; },
      getCurrentDirectory: function() { return ""; },
      getNewLine: function() { return "\n"; }
    };
  }

  /* Walk the AST of the program */
  /* Pass in typechecker instead of program */
  walk(sourcefile: ts.SourceFile, typeChecker: ts.TypeChecker) {
    var map = this.renameMap;

    ts.forEachChild(sourcefile, function(node) {
      traverse(node, typeChecker, map, '');
    });

    /* Somewhat of a misnomer to refer to pString as "parent" */
    function traverse(node: ts.Node, typeChecker: ts.TypeChecker, renameMap, pString: string) {
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
          var classDeclaration = <ts.ClassDeclaration>node;
          //parent.push(classDeclaration.name.text);
          pString = updateParentString(pString, classDeclaration.name.text);
          console.log('ClassDeclaration');
          console.log(classDeclaration);
          //console.log(classDeclaration.members);

          // for (var mem in classDeclaration.members) {
          //   var member = classDeclaration.members[mem];
          //   console.log(member);
          //   console.log("member.kind " + member.kind);
          // }
          break;
        case ts.SyntaxKind.PropertyAssignment:
          break;
        /* This is where we rename the property and add it to the dictionary */
        case ts.SyntaxKind.PropertyDeclaration:
          console.log('PropertyDeclaration ' + 'parent: ' + pString);
          var pd = <ts.PropertyDeclaration>node;
          pString = updateParentString(pString, pd.name.text);
          console.log("type ");
          getType(pd.type);

          //console.log("TODO ADD TO RENAME MAP: " + pString);
          //renameMap.set(pString, "NOTHING YET");
          break;
        case ts.SyntaxKind.Constructor:
          break;
        case ts.SyntaxKind.MethodDeclaration:
          break;
        case ts.SyntaxKind.ShorthandPropertyAssignment:
          break;
        case ts.SyntaxKind.BinaryExpression:
          break;
        case ts.SyntaxKind.Identifier:
          break;
        case ts.SyntaxKind.DotToken:
          break;
        case ts.SyntaxKind.PropertyAccessExpression:
          var pae = <ts.PropertyAccessExpression>node;
          var lhs = pae.expression;

          if (lhs.text) {
            console.log("PropertyAE lhs.text");
            //parent.push(pae.name.text);
            //parent.push(lhs.text);
            pString = updateParentString(lhs.text + '$' + pae.name.text, pString);
            console.log("TODO ADD TO RENAME MAP: " + pString);
            //renameMap.set(pString, "NOTHING YET");
            getType(pae);
          } else if (lhs.expression) {
            console.log("PropertyAE lhs.expression");
            pString = updateParentString(pae.name.text, pString);
            getType(pae);
          } else {
            console.log("PropertyAE else");
            //parent.push(pae.name.text);
            pString = updateParentString(pString, pae.name.text);
            //console.log("TODO ADD TO RENAME MAP: " + pString);
            //renameMap.set(pString, "NOTHING YET");
          }
          break;
      }

      ts.forEachChild(node, function(node) {
        traverse(node, typeChecker, renameMap, pString);
      });
    }

    //printMap(this.renameMap);

    function getType(node: ts.Node): string {
      // TODO: Add type checking to "top-level" expressions
      try {
        console.log("TYPECHECKER");
        console.log(typeChecker.typeToString(typeChecker.getTypeAtLocation(node)));
        return typeChecker.typeToString(typeChecker.getTypeAtLocation(node));
      } catch(error) {
        console.log("TYPECHECKER ERROR " + error.stack);
        return "error";
      }
    }

    function printMap(map: Map<any, any>) {
      console.log('============ Rename Map ===============');
      map.forEach(function(value, key) {
        console.log(key + " = " + value);
      }, map);
      console.log('============ Rename Map ===============');
    }

    /* Report information when necessary */
    function report(node: ts.Node, message: string) {
      var lc = sourcefile.getLineAndCharacterOfPosition(node.getStart());
      console.log('${sourcefile.fileName} (${lc.line + 1},${lc.character + 1}): ${message}');
    }

    /* Concat the 'parent' and 'child' strings */
    function updateParentString(p: string, c: string): string {
      if (p.length === 0) {
        return c;
      } else if (c.length === 0) {
        return p;
      } else {
        return p + '$' + c;
      }
    }

    /* TODO: Get rid of it or figure out if it's needed */
    function dfs(node) {
      console.log(node);
      if (node.expression) {
        console.log(node.expression);
        dfs(node.expression);
      } else {
        return node;
      }
    }

    /* TODO: Get rid of it or figure out if it's needed */
    function childrenExist(topNode) {
      var count = 0;
      ts.forEachChild(topNode, function(node) {
        if (node) count++;
      });

      console.log(count);

      return (count > 0);
    }
  }

  /* 
   * Given a char, generate the next character in the alphabet.
   */
  nextChar(c: string): string {
    return String.fromCharCode(c.charCodeAt(0) + 1);
  }

  /* Returns a string for the new property name */
  /* 0 -> a, 1 -> b, ... 25 -> z, 26 -> aa , ...*/
  generateNextLateralPropertyName(code: string): string {
    var chars = code.split('');
    console.log(chars);
    var len: number = code.length;
    var last: string = chars[len - 1];

    /* Grab the next letter using nextChar */
    for (var i = len - 1; i >= 0; i--) {
      if (chars[i] !== 'z') {
        chars[i] = this.nextChar(chars[i]);
        break;
      } else {
        chars[i] = 'a';
        if (i === 0) {
          return 'a' + (chars.join(''));             
        }
      }
    }
    return chars.join('');
  }  

  /* Given a key, assign a generated property shortname */
  assignNewPropertyName(propName: string, lhsType: string): void {
    var prevRename = this.getLastRename(lhsType);
    var newPropName = this.generateNextLateralPropertyName(prevRename);
    var value = new PropertyInfo(lhsType, newPropName);
    /* 
     * Add the PropertyInfo for the property name in a new list since this property name might
     * not be unique.
     */
    if (!this.renameMap.get(propName)) {
      this.renameMap.set(propName, [value]);
    } else {
      var arr = this.renameMap.get(propName);
      this.renameMap.set(propName, arr.push(value));
    }
    this.updateLastRename(lhsType, newPropName);
  }

  /* Update the last renamed property for the lhs expression */
  updateLastRename(key: string, rename: string): void {
    this.prevNameMap.set(key, rename);
  }

  getLastRename(key: string): string {
    /*
     * This LHS expression does not exist yet. Add it to the prevNameMap.
     */
    if (!this.prevNameMap.get(key)) {
      /* Set initial last property name to '' so 'a' can be generated correctly since
       * generateNextLateralPropertyName is based on the most recently generated name.
       */
      this.prevNameMap.set(key, '');
      return '';
    } else {
      return this.prevNameMap.get(key);
    }
  }
}

var renamer = new Renamer();
var host = renamer.createCompilerHost(['../../test/hello.ts']);
//console.log('created compiler host');
var source : ts.SourceFile = host.getSourceFile('../../test/hello.ts', ts.ScriptTarget.ES6);

// to create the program, the host calls getSourceFile 
// IF you pass in a host. It's an optional parameter
var program : ts.Program = 
  ts.createProgram(['../../test/hello.ts'], renamer.getCompilerOptions());
renamer.walk(source, program.getTypeChecker());
