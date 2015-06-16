///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/typescript.d.ts"/>
var ts = require('typescript');
var fs = require('fs'); // filesystem module
//import process = require('process');
// export const COMPILER_OPTIONS: ts.CompilerOptions = {
// 	allowNonTsExtensions: true,
// 	module: ts.ModuleKind.CommonJS,
// 	target: ts.ScriptTarget.ES5,
// };
/* TranspilerOptions Class will go here */
/* The Transpiler Class */
var Transpiler = (function () {
    //private transpilers;
    // (Transpiler options here when I know what's needed) 
    function Transpiler() {
        // will instantiate different transpilers; nothing here yet
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
            console.log(`${diagnostic.file.fileName} (${loc.line + 1},${loc.character + 1}): ${message}`);
        });
        var exitCode = emitResult.emitSkipped ? 1 : 0;
        console.log(`Process exiting with code '${exitCode}'.`);
        process.exit(exitCode);
    };
    Transpiler.prototype.callCompile = function () {
        this.compile(process.argv.slice(2), {
            noEmitOnError: true,
            noImplicitAny: true,
            target: 1 /* ES5 */,
            module: 1 /* CommonJS */
        });
    };
    Transpiler.prototype.transform = function () {
    };
    // return set options for the compiler
    Transpiler.prototype.getCompilerOptions = function () {
        const options = {
            allowNonTsExtensions: true,
            module: 1 /* CommonJS */,
            target: 2 /* ES6 */,
        };
        return options;
    };
    /* Create a Transpiler Class */
    Transpiler.prototype.createCompilerHost = function (fileNames, options) {
        var _this = this;
        console.log("create compiler host");
        console.log(fileNames);
        // why is this needed? rather, what is the point?
        var fileMap = {};
        fileNames.forEach(function (f) { return fileMap[f] = true; }); // why?
        // sanity check that given files actually exist
        fileNames.forEach(function (fpath) {
            fs.exists(fpath, function (exists) {
                console.log(exists ? "exists" : "nope :(");
            });
        });
        // the methods of a compiler host object
        return {
            getSourceFile: function (sourceName, languageVersion) {
                console.log('does this occur');
                if (fileMap.hasOwnProperty(sourceName)) {
                    console.log('hello?');
                    var contents = fs.readFileSync(sourceName, 'UTF-8');
                    console.log(contents);
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
            getDefaultLibFileName: function () {
                return "lib.d.ts";
            },
            useCaseSensitiveFileNames: function () {
                return true;
            },
            getCanonicalFileName: function (filename) {
                return filename;
            },
            getCurrentDirectory: function () {
                return "";
            },
            getNewLine: function () {
                return "\n";
            }
        };
    };
    return Transpiler;
})();
exports.Transpiler = Transpiler;
var transpiler = new Transpiler();
// var host = transpiler.createCompilerHost(['test/hello.ts']);
// var source = host.getSourceFile('test/hello.ts', ts.ScriptTarget.ES6);
// console.log(source);
transpiler.callCompile();

//# sourceMappingURL=main.js.map