///<reference path="../typings/node/node.d.ts"/>
///<reference path="../typings/typescript/typescript.d.ts"/>

import * as ts from 'typescript';
import * as fs from 'fs';
// import * as fsx from 'fs-extra/';
import * as util from 'util';
import * as path from 'path';

/* TranspilerOptions Class will go here */

const DEBUG = true;

export const COMPILER_OPTIONS: ts.CompilerOptions = {
  allowNonTsExtensions : true,
  module : ts.ModuleKind.CommonJS,
  target : ts.ScriptTarget.ES5,
  experimentalDecorators : true
};

export function ident(n: ts.Node): string {
  if (n.kind === ts.SyntaxKind.Identifier)
    return (<ts.Identifier>n).text;
  if (n.kind === ts.SyntaxKind.QualifiedName) {
    var qname = (<ts.QualifiedName>n);
    var leftName = ident(qname.left);
    if (leftName)
      return leftName + '.' + ident(qname.right);
  } /* Not sure what a qualified name is */
  return null;
}

/* The Transpiler Class */
export class Transpiler {
  private output: Output;
  private currentFile: ts.SourceFile;
  private typeChecker: ts.TypeChecker;

  /*
   * "Stupid Mode" will rename properties indiscriminantly. If anything is named
   * "foo", it will be
   * renamed to global new name for "foo".
   */
  stupidMode: boolean;

  /*
   * List of properties, and their remappings. Key is the property name, value
   * is a PropertyInfo
   * object which has what type its parent is (left hand side expression) and
   * its new name.
   */
  renameMap = new Map();
  /*
   * List of "root" names, and the last property name assigned to one of its
   * properties.
   * ie: Foo is a class. Foo has properties x, y, z which were renamed to a, b,
   * c.
   * { Foo: 'c' } allows easy access to Foo's last renamed property so we can
   * use
   * getNextLateralPropertyName per Class/"root".
   */
  prevNameMap = new Map();

  /* For "stupid mode" */
  prevName: string = '';

  /* Not sure if needed */
  nodes: ts.Node[] = [];

  /* Not needed as of now */
  private errors: string[] = [];

  constructor() { /* nothing here yet */
  }

  emit(s: string) {
    if (DEBUG)
      console.log('emit called!\n');
    this.output.emit(s);
  }

  /* return set options for the compiler */
  getCompilerOptions(): ts.CompilerOptions {
    const options: ts.CompilerOptions = {
      allowNonTsExtensions : true,
      module : ts.ModuleKind.CommonJS,
      target : ts.ScriptTarget.ES5,
    };
    return options;
  }

  createCompilerHost(): ts.CompilerHost {

    var defaultLibFileName =
        ts.getDefaultLibFileName(this.getCompilerOptions());

    /* the methods of a compiler host object */
    return {
      getSourceFile : (sourceName, languageVersion) => {
        var path = sourceName;
        if (sourceName === defaultLibFileName) {
          path = ts.getDefaultLibFilePath(this.getCompilerOptions());
        }
        if (!fs.existsSync(path)) {
          if (DEBUG)
            console.log(path + ' DNE :C\n');
          return undefined;
        }
        var contents = fs.readFileSync(path, 'UTF-8');
        return ts.createSourceFile(sourceName, contents,
                                   this.getCompilerOptions().target, true);
      },
      // these are not used; just exist to satisfy interface.
      writeFile : function(name, text, writeByteOrderMark, outputs) {
        fs.writeFile(name, text);
      },
      getDefaultLibFileName : function() { return defaultLibFileName; },
      useCaseSensitiveFileNames : function() { return true; },
      getCanonicalFileName : function(filename) { return filename; },
      getCurrentDirectory : function() { return ""; },
      getNewLine : function() { return "\n"; }
    };
  }

  /*
   * TODO: We want to take the filenames and output the
   * renamed files in the same directory (for now).
   * Therefore, destination parameter is un-needed.
   *
   * TODO: Error checking / Error Reporting
   */
  transpile(fileNames: string[], destination?: string): void {
    var host = this.createCompilerHost();
    var program = ts.createProgram(fileNames, this.getCompilerOptions(), host);
    var typeChecker = program.getTypeChecker(); /* Where should this happen? */

    // Only write files that were explicitly passed in.
    var fileMap: {[s: string] : boolean} = {};
    fileNames.forEach((f) => fileMap[this.normalizeSlashes(f)] = true);

    this.errors = [];
    program.getSourceFiles()
        .filter((sourceFile) => fileMap[sourceFile.fileName])
        // Do not generate output for .d.ts files.
        .filter((sourceFile: ts.SourceFile) =>
                    !sourceFile.fileName.match(/\.d\.ts$/))
        .forEach((f: ts.SourceFile) => {
          this.getNodeKindInfo(f);
          var renamedCode = this.translate(f, typeChecker);
          var outputFile = this.getOutputPath(f.fileName);
          // fsx.mkdirsSync(path.dirname(outputFile));
          fs.writeFileSync(outputFile, renamedCode);
        });
    this.checkForErrors(program);
  }

  private walkChildren(node: ts.Node) {
    ts.forEachChild(node, (child) => this.visit(child));
  }

  /* Walk the AST of the program */
  walk(sourcefile: ts.SourceFile, typeChecker: ts.TypeChecker) {
    this.currentFile = sourcefile;
    this.traverse(sourcefile);
    this.printMap(this.renameMap);
  }

  /*
   * VISITOR PATTERN: Emitting output
   * TODO: Organize cases into parts of the syntax
   */
  visit(node: ts.Node, indent?: number) {
    switch (node.kind) {
      /* ========================================= */
      /* DECLARATIONS
      /* ========================================= */
      case ts.SyntaxKind.VariableDeclarationList:
        // Note from Martin: VariableDeclarationList can only occur as part of a
        // for loop.
        var varDeclList = <ts.VariableDeclarationList>node;
        if (DEBUG)
          console.log('variable declaration list');
        /* Visit list of variable declarations */
        varDeclList.declarations.forEach((decl) => {this.visit(decl)});
        break;
      case ts.SyntaxKind.VariableDeclaration:
        if (DEBUG)
          console.log('variable declaration!');
        var vd = <ts.VariableDeclaration>node;
        if (DEBUG)
          console.log(vd);
        this.emit('var ');
        this.visit(vd.name);
        if (vd.type)
          this.emit(': ' + vd.type.getText());

        if (vd.initializer) {
          this.emit(' = ');
          if (DEBUG)
            console.log(vd.initializer.kind + ' ' +
                        ts.SyntaxKind[vd.initializer.kind]);
          /* New Expression */
          this.visit(vd.initializer);
        }
        break;
      case ts.SyntaxKind.ClassDeclaration:
        var cd = <ts.ClassDeclaration>node;
        if (DEBUG)
          console.log(cd);
        this.visitClassLike('class ', cd);
        break;
      case ts.SyntaxKind.InterfaceDeclaration:
        break;
      case ts.SyntaxKind.HeritageClause:
        break;
      case ts.SyntaxKind.EnumDeclaration:
        break;
      case ts.SyntaxKind.EnumMember:
        break;
      case ts.SyntaxKind.Constructor:
        var constructor = <ts.ConstructorDeclaration>node;
        var body = constructor.body;
        var parent = constructor.parent;
        var params = constructor.parameters;
        var paramsSize = params.length;

        /* TODO: visitDeclarationMetaData */
        /* .... */
        this.emit('constructor ');
        /* Visit parameters */
        this.visitParameters(params);

        /* Constructor stuff yay */
        this.emit('{');
        /* Visit body of constructor */
        this.visit(body);
        this.emit('}');
        break;
      case ts.SyntaxKind.PropertyDeclaration:
        var pd = <ts.PropertyDeclaration>node;
        if (DEBUG)
          console.log('propertydeclaration!');
        this.visitProperty(pd);
        break;
      case ts.SyntaxKind.GetAccessor:
        break;
      case ts.SyntaxKind.SetAccessor:
        break;
      case ts.SyntaxKind.SemicolonClassElement:
        /* ??? */
        break;
      case ts.SyntaxKind.MethodDeclaration:
        var md = <ts.MethodDeclaration>node;
        if (DEBUG)
          console.log('MethodDeclaration!');
        this.visitFunctionLike(md);
        break;
      case ts.SyntaxKind.FunctionDeclaration:
        var funcDecl = <ts.FunctionDeclaration>node;
        this.visitDecorators(funcDecl.decorators);
        // Visit function decorators
        // function typeparameters
        this.emit('function '); // where should this emit go
        this.visitFunctionLike(funcDecl);
        break;
      case ts.SyntaxKind.ArrowFunction:
        var arrowFunc = <ts.ArrowFunction>node;
        this.visitParameters(arrowFunc.parameters);
        this.emit('=>');
        this.visit(arrowFunc.body);
        break;
      case ts.SyntaxKind.FunctionExpression:
        var fe = <ts.FunctionExpression>node;
        this.visitFunctionLike(fe);
        break;
      case ts.SyntaxKind.PropertySignature:
        break;
      case ts.SyntaxKind.MethodSignature:
        break;
      case ts.SyntaxKind.Parameter:
        var paramDecl = <ts.ParameterDeclaration>node;

        // visit decorators
        // check for dotdotdot token
        // name
        // question token
        // type
        // initializer

        this.visitDecorators(paramDecl.decorators);
        if (paramDecl.dotDotDotToken)
          this.emit('...');
        this.visit(paramDecl.name);
        if (paramDecl.questionToken)
          this.visit(paramDecl.questionToken);
        if (paramDecl.type) {
          this.emit(': ');
          this.visit(paramDecl.type);
        }
        if (paramDecl.initializer) {
          this.emit('=');
          this.visit(paramDecl.initializer);
        }

        break;
      case ts.SyntaxKind.ObjectBindingPattern:
        break;
      case ts.SyntaxKind.BindingElement:
        break;
      case ts.SyntaxKind.StaticKeyword:
        break;
      case ts.SyntaxKind.PrivateKeyword:
        break;
      case ts.SyntaxKind.ProtectedKeyword:
        break;
      /* =================================== */
      /* STATEMENTS
      /* =================================== */
      case ts.SyntaxKind.EmptyStatement:
        this.emit(';');
        break;
      case ts.SyntaxKind.ReturnStatement:
        if (DEBUG)
          console.log('Return Statement!');
        var rs = <ts.ReturnStatement>node;
        this.emit('return');

        if (rs.expression) {
          this.emit(' ');
          this.visit(rs.expression);
        }
        this.emit(';');
        break;
      case ts.SyntaxKind.VariableStatement:
        if (DEBUG)
          console.log('Variable Statement');
        var vs = <ts.VariableStatement>node;
        this.visit(vs.declarationList);
        this.emit(';');
        break;
      case ts.SyntaxKind.ExpressionStatement:
        if (DEBUG)
          console.log('expression statement!');
        var es = <ts.ExpressionStatement>node;
        if (DEBUG)
          console.log(ts.SyntaxKind[es.expression.kind]);
        this.visit(es.expression);
        break;
      case ts.SyntaxKind.SwitchStatement:
        var switchStatement = <ts.SwitchStatement>node;
        this.emit('switch (');
        this.visit(switchStatement.expression);
        this.emit(')');
        this.visit(switchStatement.caseBlock);
        break;
      case ts.SyntaxKind.CaseBlock:
        var caseBlock = <ts.CaseBlock>node;
        this.emit('{');
        this.visitEach(caseBlock.clauses);
        this.emit('}');
        break;
      case ts.SyntaxKind.CaseClause:
        var caseClause = <ts.CaseClause>node;
        this.emit('case');
        this.visit(caseClause.expression);
        this.emit(':');
        this.visitEach(caseClause.statements);
        break;
      case ts.SyntaxKind.DefaultClause:
        var defaultClause = <ts.DefaultClause>node;
        this.emit('default:');
        this.visitEach(defaultClause.statements);
        break;
      case ts.SyntaxKind.IfStatement:
        var ifStatement = <ts.IfStatement>node;
        this.emit('if (');
        this.visit(ifStatement.expression);
        this.emit(')');
        this.visit(ifStatement.thenStatement);
        if (ifStatement.elseStatement) {
          this.emit('else');
          this.visit(ifStatement.elseStatement);
        }
        break;
      case ts.SyntaxKind.ForStatement:
        var forStatement = <ts.ForStatement>node;
        this.emit('for (');
        if (forStatement.initializer)
          this.visit(forStatement.initializer);
        this.emit(';');
        if (forStatement.condition)
          this.visit(forStatement.condition);
        this.emit(';');
        if (forStatement.iterator)
          this.visit(forStatement.iterator);
        this.emit(')');
        this.visit(forStatement.statement);
        break;
      /* PICK UP HERE */
      case ts.SyntaxKind.ForInStatement:
        var forInStmt = <ts.ForInStatement>node;
        this.emit('for(');
        this.visit(forInStmt.initializer);
        this.emit(' in ');
        this.visit(forInStmt.expression);
        this.emit(')');
        this.visit(forInStmt.statement);
        break;
      case ts.SyntaxKind.PropertyAssignment:
        break;
      /* =============================== */
      /* EXPRESSIONS
      /* =============================== */
      case ts.SyntaxKind.BinaryExpression:

        console.log('binary expression!');
        var be = <ts.BinaryExpression>node;
        var left = be.left;
        var operatorToken = be.operatorToken;
        var right = be.right;

        console.log('left ' + ts.SyntaxKind[left.kind]);
        console.log('right ' + ts.SyntaxKind[right.kind])

            this.visit(left);
        this.emit(' ' + operatorToken.getText() + ' ');
        this.visit(right);
        break;
      case ts.SyntaxKind.PrefixUnaryExpression:
        var pu = <ts.PrefixUnaryExpression>node;
        this.visit(pu);
        break;
      case ts.SyntaxKind.PostfixUnaryExpression:
        break;
      case ts.SyntaxKind.ConditionalExpression:
        break;
      case ts.SyntaxKind.DeleteExpression:
        break;
      case ts.SyntaxKind.VoidExpression:
        break;
      case ts.SyntaxKind.TypeOfExpression:
        break;
      case ts.SyntaxKind.ParenthesizedExpression:
        break;
      case ts.SyntaxKind.ElementAccessExpression:
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        var pae = <ts.PropertyAccessExpression>node;
        var lhs = pae.expression;
        var name = pae.name;

        /* Undefined, so break */
        if (!lhs) {
          break;
        }

        if (DEBUG)
          console.log(ts.SyntaxKind[lhs.kind]);
        this.visit(lhs);
        this.visit(pae.dotToken);
        this.visit(name);

        /* TODO: Explore when to put ;\n */
        if (pae.parent.kind === ts.SyntaxKind.ExpressionStatement)
          this.emit(';');

        break;
      /* =================================== */
      /* TYPES
      /* =================================== */
      case ts.SyntaxKind.TypeLiteral:
        break;
      case ts.SyntaxKind.UnionType:
        break;
      case ts.SyntaxKind.TypeReference:
        break;
      case ts.SyntaxKind.TypeAssertionExpression:
        break;
      case ts.SyntaxKind.TypeParameter:
        break;
      case ts.SyntaxKind.ArrayType:
        var at = <ts.ArrayTypeNode>node;
        break;
      case ts.SyntaxKind.FunctionType:
        break;
      case ts.SyntaxKind.QualifiedName:
        break;
      case ts.SyntaxKind.Identifier:
        var id = <ts.Identifier>node;
        if (DEBUG)
          console.log('identifier!');
        this.visitTypeName(id);
        break;
      /* ========================================= */
      /* KEYWORDS
      /* ========================================= */
      case ts.SyntaxKind.ExportKeyword:
        if (DEBUG)
          console.log('export keyword');
        this.emit('export ');
        break;
      case ts.SyntaxKind.NumberKeyword:
        this.emit('number ');
        break;
      case ts.SyntaxKind.StringKeyword:
        this.emit('string ');
        break;
      case ts.SyntaxKind.VoidKeyword:
        this.emit('void ');
        break;
      case ts.SyntaxKind.BooleanKeyword:
        this.emit('boolean ');
        break;
      case ts.SyntaxKind.AnyKeyword:
        this.emit('any ');
        break;
      /* =================================== */
      /* CALL
      /* =================================== */
      case ts.SyntaxKind.Block:
        if (DEBUG)
          console.log('block!');
        var block = <ts.Block>node;
        this.visitBlock(block);
        break;
      case ts.SyntaxKind.NewExpression:
        if (DEBUG)
          console.log('new expression');
        var newExp = <ts.NewExpression>node;
        if (DEBUG)
          console.log(newExp);

        /* visitCall() */
        var lhs = newExp.expression;
        var typeArgs = newExp.typeArguments;
        var args = newExp.arguments;
        this.emit('new ');
        this.visit(lhs);
        this.emit('(');
        /* TODO: Differentiate between TypeArgs and Args */
        var argSize = args.length;
        this.visitList(args);
        this.emit(')');
        break;
      case ts.SyntaxKind.CallExpression:
        var callExpr = <ts.CallExpression>node;
        this.visit(callExpr.expression);
        this.emit('(');
        this.visitList(callExpr.arguments);
        this.emit(')');
        break;
      case ts.SyntaxKind.SuperKeyword:
        break;
      /* =================================== */
      /* LITERALS
      /* =================================== */
      case ts.SyntaxKind.NumericLiteral:
        break;
      case ts.SyntaxKind.StringLiteral:
        var sl = <ts.StringLiteralTypeNode>node;
        this.emit(sl.getText());
        break;
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        break;
      case ts.SyntaxKind.TemplateMiddle:
        break;
      case ts.SyntaxKind.TemplateExpression:
        break;
      case ts.SyntaxKind.TemplateHead:
        break;
      case ts.SyntaxKind.TemplateTail:
        break;
      case ts.SyntaxKind.TemplateSpan:
        break;
      case ts.SyntaxKind.ArrayLiteralExpression:
        break;
      case ts.SyntaxKind.ObjectLiteralExpression:
        break;
      case ts.SyntaxKind.PropertyAssignment:
        break;
      case ts.SyntaxKind.ShorthandPropertyAssignment:
        break;
      case ts.SyntaxKind.TrueKeyword:
        break;
      case ts.SyntaxKind.FalseKeyword:
        break;
      case ts.SyntaxKind.NullKeyword:
        break;
      case ts.SyntaxKind.RegularExpressionLiteral:
        break;
      case ts.SyntaxKind.ThisKeyword:
        this.emit('this');
        break;
      /* =================================== */
      /* ELSE
      /* =================================== */
      case ts.SyntaxKind.DotToken:
        this.emit('.');
        break;
    }
  }

  visitClassLike(keyword: string, decl: ts.ClassDeclaration) {
    /* TODO: Visit decorators*/
    /* ... */

    if (DEBUG)
      console.log(decl.modifiers);
    if (decl.modifiers) {
      decl.modifiers.forEach((mod) => this.visit(mod));
    }

    this.emit(keyword);

    this.visitTypeName(decl.name);

    /* TODO: Visit type name */
    /* .... */

    this.emit(' {');

    if (DEBUG)
      console.log(decl);
    decl.members.forEach((memb) => {
      if (DEBUG)
        console.log(memb);
      if (DEBUG)
        console.log(memb.kind + ': ' + ts.SyntaxKind[memb.kind]);
      this.visit(memb);
    });

    /* Go through property parameters here, think about public and private
     * properties */
    /* Visit constructor declaration */
    /* Method declarations - function-like */

    this.emit('}');
  }

  visitConstructor(constructorDecl: ts.ConstructorDeclaration) {}

  /* figure out what's happening here */
  private visitParameters(parameters: ts.ParameterDeclaration[]) {
    this.emit('(');
    let firstInitParamIdx = 0;
    for (; firstInitParamIdx < parameters.length; firstInitParamIdx++) {
      // ObjectBindingPatterns are handled within the parameter visit.
      let isOpt = parameters[firstInitParamIdx].initializer ||
                  parameters[firstInitParamIdx].questionToken;
      if (isOpt &&
          parameters[firstInitParamIdx].name.kind !==
              ts.SyntaxKind.ObjectBindingPattern) {
        break;
      }
    }

    if (firstInitParamIdx !== 0) {
      var requiredParams = parameters.slice(0, firstInitParamIdx);
      this.visitList(requiredParams);
    }

    /* What is going on here though */
    if (firstInitParamIdx !== parameters.length) {
      if (firstInitParamIdx !== 0)
        this.emit(',');
      var positionalOptional =
          parameters.slice(firstInitParamIdx, parameters.length);
      // this.emit('[');
      this.visitList(positionalOptional);
      // this.emit(']');
    }

    this.emit(')');
  }

  visitTypeName(typeName: ts.EntityName) {
    if (typeName.kind !== ts.SyntaxKind.Identifier) {
      this.visit(typeName);
      return;
    }
    var identifier = ident(typeName);
    if (this.renameMap.get(identifier)) {
      identifier = this.renameMap.get(identifier);
    }
    this.emit(identifier);
  }

  // private visitFunctionLike(fn: ts.FunctionLikeDeclaration, accessor?:
  // string) {
  //     if (fn.type) {
  //       if (fn.kind === ts.SyntaxKind.ArrowFunction) {
  //         // Type is silently dropped for arrow functions, not supported in
  //         Dart.
  //         this.emit('/*');
  //         this.visit(fn.type);
  //         this.emit('*/');
  //       } else {
  //         this.visit(fn.type);
  //       }
  //     }
  //     if (accessor) this.emit(accessor);
  //     if (fn.name) this.visit(fn.name);
  //     // Dart does not even allow the parens of an empty param list on getter
  //     if (accessor !== 'get') {
  //       this.visitParameters(fn.parameters);
  //     } else {
  //       if (fn.parameters && fn.parameters.length > 0) {
  //         this.reportError(fn, 'getter should not accept parameters');
  //       }
  //     }
  //     if (fn.body) {
  //       this.visit(fn.body);
  //     } else {
  //       this.emit(';');
  //     }
  //   }

  visitFunctionLike(fn: ts.FunctionLikeDeclaration, accessor?: string) {

    // asteriskToken
    // name
    // typeParameters
    // parameters
    // body

    if (fn.type)
      this.visit(fn.type);
    if (accessor)
      this.emit(accessor);

    if (fn.name)
      this.visit(fn.name);
    /* TODO: Getters */
    this.visitParameters(fn.parameters);
    if (fn.body) {
      this.emit(' {');
      this.visit(fn.body);
      this.emit('}');
    } else {
      this.emit(';');
    }

    /* TODO: Look and see if return type information exists */
    /* .... */
  }

  /* This can probably also apply to ParameterDeclaration */
  visitProperty(pd: ts.PropertyDeclaration) {
    if (DEBUG)
      console.log('visitProperty');
    this.visit(pd.name);
    if (pd.questionToken)
      this.emit('?');

    if (pd.type) {
      var _type = pd.type.getText();
      this.emit(': ' + _type);
    }
    this.emit(';');
  }

  visitBlock(block: ts.Block) {
    if (DEBUG)
      console.log('visitBlock');
    block.statements.forEach((statement) => {
      if (DEBUG)
        console.log(ts.SyntaxKind[statement.kind]);
      this.visit(statement);
      this.emit(';');
    });
  }

  visitExpression(expression: ts.Expression) {}

  visitStatement(statement: ts.Statement) {
    if (DEBUG)
      console.log('visitStatement');
    if (DEBUG)
      console.log(statement);
  }

  private visitDecorators(decorators: ts.NodeArray<ts.Decorator>) {
    if (!decorators)
      return;

    decorators.forEach((d) => {
      this.emit('@');
      this.visit(d.expression);
    });
  }

  /*
   * TODO: Figure out if pString should be kept.
   * Clean up: Don't need a case for each syntax kind since we are only
   * concerned with property declarations (for now) to create the rename map.
   */
  traverse(node: ts.Node, typeChecker?: ts.TypeChecker, pString?: string) {
    if (DEBUG)
      console.log(node.kind + ': ' + ts.SyntaxKind[node.kind]);
    switch (node.kind) {
    /* If the identifier's parent is a PropertyDeclaration, add it to the
     * dictionary */
    case ts.SyntaxKind.Identifier:
      var id = <ts.Identifier>node;
      var enumKind = id.parent.kind;
      if (DEBUG)
        console.log('gparent: ' + ts.SyntaxKind[id.parent.parent.kind]);
      if (DEBUG)
        console.log('parent: ' + ts.SyntaxKind[enumKind]);
      if (DEBUG)
        console.log('id.text ' + id.text);
      if (DEBUG)
        console.log('=============================');

      /* TODO: Does an Identifier's parent have to be a Property Declaration AND
       * a ClassDeclaration? */
      if (id.parent.kind === ts.SyntaxKind.PropertyDeclaration &&
          id.parent.parent.kind === ts.SyntaxKind.ClassDeclaration) {
        /* Add to rename map */
        this.assignNewPropertyName(id.text);
      }
      break;
    }

    ts.forEachChild(node, (node) => this.traverse(node));
  }

  getType(node: ts.Node, typeChecker: ts.TypeChecker): string {
    try {
      if (DEBUG)
        console.log("TYPECHECKER");
      if (DEBUG)
        console.log(
            typeChecker.typeToString(typeChecker.getTypeAtLocation(node)));
      return typeChecker.typeToString(typeChecker.getTypeAtLocation(node));
    } catch (error) {
      if (DEBUG)
        console.log("TYPECHECKER ERROR " + error.stack);
      return "error";
    }
  }

  printMap(map: Map<any, any>) {
    if (DEBUG)
      console.log('============ Rename Map ===============');
    map.forEach(function(value, key) {
      if (DEBUG)
        console.log(key + " = " + value);
    }, map);
    if (DEBUG)
      console.log('============ Rename Map ===============');
  }

  /* Concat the 'parent' and 'child' strings */
  updateParentString(p: string, c: string): string {
    if (p.length === 0) {
      return c;
    } else if (c.length === 0) {
      return p;
    } else {
      return p + '$' + c;
    }
  }

  /*
   * Given a char, generate the next character in the alphabet.
   */
  nextChar(c: string): string {
    return String.fromCharCode(c.charCodeAt(0) + 1);
  }

  /* Given the last code, returns a string for the new property name        */
  /* Ie: given 'a', will return 'b', given 'az', will return 'ba', etc. ... */
  generateNextLateralPropertyName(code: string): string {
    var chars = code.split('');
    var len: number = code.length;

    if (len === 0) {
      return 'a';
    }

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
  assignNewPropertyName(propName: string, lhsType?: string): void {

    if (this.stupidMode) {
      var newName = this.generateNextLateralPropertyName(this.prevName);
      if (!this.renameMap.get(propName)) {
        this.renameMap.set(propName, newName);
        this.prevName = newName;
      } // else do nothing, this re-mapping already exists

    } else {
      var prevRename = this.getLastRename(lhsType);
      var newPropName = this.generateNextLateralPropertyName(prevRename);
      var value = new PropertyInfo(lhsType, newPropName);
      /*
       * Add the PropertyInfo for the property name in a new list since this
       * property name might
       * not be unique.
       */
      if (!this.renameMap.get(propName)) {
        this.renameMap.set(propName, [ value ]);
      } else {
        var arr = this.renameMap.get(propName);
        this.renameMap.set(propName, arr.push(value));
      }
      this.updateLastRename(lhsType, newPropName);
    }
  }

  /* Update the last renamed property for the lhs expression */
  private updateLastRename(key: string, rename: string): void {
    this.prevNameMap.set(key, rename);
  }

  private getLastRename(key: string): string {
    /*
     * This LHS expression does not exist yet. Add it to the prevNameMap.
     */
    if (!this.prevNameMap.get(key)) {
      /*
       * Set initial last property name to '' so 'a' can be generated correctly
       * since
       * generateNextLateralPropertyName is based on the most recently generated
       * name.
       */
      this.prevNameMap.set(key, '');
      return '';
    } else {
      return this.prevNameMap.get(key);
    }
  }

  private normalizeSlashes(path: string) { return path.replace(/\\/g, "/"); }

  getOutputPath(filePath: string): string {
    var parsedFile = path.parse(filePath);
    var renamedFile =
        parsedFile.dir + '/' + parsedFile.name + '_renamed' + parsedFile.ext;
    return renamedFile;
  }

  /* Visible for debugging */
  getOutput() { return this.output.getResult(); }

  translate(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): string {
    this.currentFile = sourceFile;
    this.typeChecker = typeChecker;
    this.output = new Output();
    /* Walk to create rename dictionary */
    this.walk(sourceFile, typeChecker);

    /* Figure out a different entry point to rename */
    ts.forEachChild(sourceFile, (node) => this.visit(node));

    return this.getOutput();
  }

  translateProgram(program: ts.Program): {[path: string] : string} {
    var paths: {[path: string] : string} = {};
    var typeChecker = program.getTypeChecker();
    this.errors = [];
    program.getSourceFiles()
        .filter((sourceFile: ts.SourceFile) =>
                    (!sourceFile.fileName.match(/\.d\.ts$/) &&
                     !!sourceFile.fileName.match(/\.[jt]s$/)))
        .forEach((f) => paths[f.fileName] = this.translate(f, typeChecker));
    this.checkForErrors(program);
    return paths;
  }

  private checkForErrors(program: ts.Program) {
    var errors = this.errors;
    var diagnostics = program.getGlobalDiagnostics().concat(
        program.getSyntacticDiagnostics());

    var diagnosticErrors = diagnostics.map(diagnostic => {
      var message = '';
      if (diagnostic.file) {
        let{line, character} =
            diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        message +=
            `Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
      }
      message += ': ';
      message += ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      return message;
    });

    if (diagnosticErrors.length)
      errors = errors.concat(diagnosticErrors);

    if (errors.length) {/* TODO: throw error specific to this project? */
    };
  }

  private getNodeKindInfo(sourceFile: ts.Node) {
    ts.forEachChild(sourceFile, (node) => {
      // if (DEBUG)
      console.log(ts.SyntaxKind[node.kind] + ': ' + node.kind);
      this.getNodeKindInfo(node);
    });
  }

  visitList(nodes: ts.Node[], separator: string = ',') {
    nodes.forEach((node, i) => {
      this.visit(node);
      if (i < nodes.length - 1)
        this.emit(separator);
    });
  }

  visitEach(nodes: ts.Node[]) { nodes.forEach((node) => this.visit(node)); }
}

/*
 * Holds information about a property added to the rename map.
 * Should this also have a field for the property's type?
 * This is needed for "smart mode".
 */
class PropertyInfo {
  private lhs: string;
  private newName: string;

  constructor(lhs: string, newName: string) {
    this.lhs = lhs;
    this.newName = newName;
  }

  getLHS(): string { return this.lhs; }

  getNewName(): string { return this.newName; }
}

class Output {
  private result: string = '';
  private column: number = 1;
  private line: number = 1;
  private indentSize: number = 2;

  constructor(
      /* private currentFile: ts.SourceFile, private relativeFileName: string */) {
  }

  emit(str: string, indent?: number) {
    this.emitIndent(indent);
    this.emitNoSpace('');
    this.emitNoSpace(str);
  }

  emitIndent(indent?: number) {
    if (!indent)
      return;

    for (var i = 1; i <= indent * this.indentSize; i++) {
      this.result += ' ';
    }
  }

  emitNoSpace(str: string) {
    this.result += str;
    for (var i = 0; i < str.length; i++) {
      if (str[i] === '\n') {
        this.line++;
        this.column = 0;
      } else {
        this.column++;
      }
    }
  }

  getResult(): string { return this.result; }
}

if (DEBUG) {
  var transpiler = new Transpiler();
  transpiler.stupidMode = true; // Flag to enable stupid mode for now.
  transpiler.transpile([ '../../test/input/basic_greeter.ts' ]);
}
