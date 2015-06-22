///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/typescript/typescript.d.ts"/>
var ts = require('typescript');
var fs = require('fs'); // filesystem module
var HashMap = require('hashmap');
/* TranspilerOptions Class will go here */
/* The Transpiler Class */
var Transpiler = (function () {
    //private transpilers;
    // (Transpiler options here when I know what's needed) 
    function Transpiler() {
        // will instantiate different transpilers; nothing here yet
        this.map = new HashMap();
        this.nodes = [];
        // last comment index?
        this.errors = [];
    }
    Transpiler.prototype.compile = function (fileNames, options) {
        var program = ts.createProgram(fileNames, options);
        var emitResult = program.emit();
        var allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        allDiagnostics.forEach(function (diagnostic) {
            var loc = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            console.log('${diagnostic.file.fileName} (${loc.line + 1},${loc.character + 1}): ${message}');
        });
        var exitCode = emitResult.emitSkipped ? 1 : 0;
        console.log("Process exiting with code '${exitCode}'.");
        process.exit(exitCode);
    };
    Transpiler.prototype.callCompile = function () {
        this.compile(process.argv.slice(2), {
            noEmitOnError: true, noImplicitAny: true,
            target: 1 /* ES5 */, module: 1 /* CommonJS */
        });
    };
    // return set options for the compiler
    Transpiler.prototype.getCompilerOptions = function () {
        var options = {
            allowNonTsExtensions: true,
            module: 1 /* CommonJS */,
            target: 2 /* ES6 */,
        };
        return options;
    };
    /* Create a Transpiler Class */
    Transpiler.prototype.createCompilerHost = function (fileNames, options) {
        var _this = this;
        // why is this needed? rather, what is the point?
        var fileMap = {};
        fileNames.forEach(function (f) { return fileMap[f] = true; }); // why?
        // sanity check that given files actually exist
        // fileNames.forEach((fpath) => {
        // 	fs.exists(fpath, function(exists) {
        // 		console.log(exists ? "exists" : "nope :(");
        // 	});
        // });
        //console.log(process.cwd());
        // the methods of a compiler host object
        return {
            getSourceFile: function (sourceName, languageVersion) {
                if (fileMap.hasOwnProperty(sourceName)) {
                    console.log('hello?');
                    console.log(sourceName);
                    var contents = fs.readFileSync(sourceName, 'UTF-8');
                    console.log("==========================================================");
                    console.log(contents);
                    console.log("==========================================================");
                    return ts.createSourceFile(sourceName, contents, _this.getCompilerOptions().target, true);
                }
                if (sourceName === "lib.d.ts")
                    return ts.createSourceFile(sourceName, '', _this.getCompilerOptions().target, true);
                return undefined;
            },
            // these are not used; just exist to satisfy interface?
            writeFile: function (name, text, writeByteOrderMark, outputs) {
                fs.writeFile(name, text);
            },
            getDefaultLibFileName: function () { return "lib.d.ts"; },
            useCaseSensitiveFileNames: function () { return true; },
            getCanonicalFileName: function (filename) { return filename; },
            getCurrentDirectory: function () { return ""; },
            getNewLine: function () { return "\n"; }
        };
    };
    /* For later? Do I even need this though. */
    Transpiler.prototype.prettyPrint = function () {
    };
    /* Walk the AST of the program */
    Transpiler.prototype.walk = function (sourcefile, program) {
        var typeChecker = program.getTypeChecker();
        //console.log(typeChecker.getTypeAtLocation(sourcefile));
        traverse(sourcefile, typeChecker);
        function traverse(node, typeChecker, count) {
            switch (node.kind) {
                case 224 /* PropertyAssignment */:
                    console.log('PropertyAssignment');
                    break;
                case 132 /* PropertyDeclaration */:
                    console.log('PropertyDeclaration');
                    break;
                case 225 /* ShorthandPropertyAssignment */:
                    console.log('ShorthandPropertyAssignment');
                    break;
                case 169 /* BinaryExpression */:
                    //console.log('BinaryExpression');
                    var binExpr = node;
                    //console.log(binExpr);
                    break;
                case 65 /* Identifier */:
                    var ident = node;
                    //console.log(typeChecker.getTypeAtLocation(ident));
                    break;
                case 20 /* DotToken */:
                    console.log("dot token, do nothing");
                    break;
                // PAE has: 
                // 1. expression: LeftHandSideExpression
                // 2. dotToken: Node
                // 3. name: Identifier (right hand side of expression)
                case 155 /* PropertyAccessExpression */:
                    var pae = node; // is this casting?
                    console.log('PropertyAccessExpression');
                    console.log("========================================================");
                    console.log(pae);
                    //console.log(pae.expression + ": " + typeChecker.typeToString(
                    //	typeChecker.getTypeAtLocation(pae.expression)));
                    //console.log(pae.name + ": " + typeChecker.typeToString(
                    //	typeChecker.getTypeAtLocation(pae.name)));
                    //console.log(pae.expression.text); // doesn't have it but it prints? I don't get it.
                    // this.map.set(pae.expression.text, { });
                    console.log("========================================================");
                    break;
            }
            ts.forEachChild(node, function (node) {
                traverse(node, typeChecker, count);
            });
        }
        /* Report information when necessary */
        function report(node, message) {
            var lc = sourcefile.getLineAndCharacterOfPosition(node.getStart());
            console.log('${sourcefile.fileName} (${lc.line + 1},${lc.character + 1}): ${message}');
        }
    };
    return Transpiler;
})();
exports.Transpiler = Transpiler;
var transpiler = new Transpiler();
var host = transpiler.createCompilerHost(['../../test/hello.ts']);
console.log('created compiler host');
var source = host.getSourceFile('../../test/hello.ts', 2 /* ES6 */);
// to create the program, the host calls getSourceFile IF you pass in a host. It's an optional parameter
var program = ts.createProgram(['../../test/hello.ts'], transpiler.getCompilerOptions());
transpiler.walk(source, program);

//# sourceMappingURL=main.js.map