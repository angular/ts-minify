import {Minifier, options, MinifierOptions} from '../../src/main';
import * as ts from 'typescript';
var exec = require('child_process').exec;


var minifier = new Minifier({failFast: true, basePath: '../..'});
minifier.renameProgram(['../input/ts2dart/lib/base.ts', '../input/ts2dart/lib/call.ts'
						, '../input/ts2dart/lib/declaration.ts', '../input/ts2dart/lib/expression.ts'
						, '../input/ts2dart/lib/facade_converter.ts', '../input/ts2dart/lib/literal.ts'
						, '../input/ts2dart/lib/main.ts', '../input/ts2dart/lib/module.ts', '../input/ts2dart/lib/statement.ts'
						, '../input/ts2dart/lib/type.ts'],
                         '../../build/output');

minifier.printRenameMap();