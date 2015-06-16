var gulp = require('gulp');
var debug = require('gulp-debug');
var inject = require('gulp-inject');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');
var merge = require('merge2');
var typescript = require('typescript');

var clangFormat = require('clang-format');
var formatter = require('gulp-clang-format');

var hasError;
var failOnError = false;

var onError = function(err) {
  console.log("onError");
  hasError = true;
  gutil.log(err.message);
  if (failOnError) {
    process.exit(1);
  }
};

var COMPILER_OPTIONS = {
  module : "commonjs",
  noExternalResolve : false,
  declarationFiles : true,
  // noEmitOnError: true - currently not possible because TS doesn't recognize
  // ES6 collections
  //                       like Map, WeakMap, etc
  // noImplicitAny: true,
  typescript : typescript,
};

// ts.createProjects takes compiler options
var tsProject = ts.createProject(COMPILER_OPTIONS);

gulp.task('test.check-format', function() {
  return gulp.src([ '*.js', 'src/**/*.ts', 'test/**/*.ts' ])
      .pipe(formatter.checkFormat('file', clangFormat))
      .on('warning', onError);
});

/**
 * Lint all custom TypeScript files.
 */
gulp.task('lint', function() {
  return gulp.src('./src/*.ts').pipe(tslint()).pipe(tslint.report('prose'));
});

/**
 * Compile TypeScript and include references to library and app .d.ts files.
 */
gulp.task('compile', function() {
  console.log("compiling");
  var sourceTsFiles = [
    './src/*.ts', // path to typescript files
    './typings/**/*.ts'
  ]; // reference to library .d.ts files

  var tsResult = gulp.src(sourceTsFiles)
                     .pipe(sourcemaps.init())
                     .pipe(ts({
                       typescript : require('typescript'),
                       target : 'es5',
                       module : 'commonjs',
                       declarationFiles : false,
                       noExternalResolve : true
                     }));

  tsResult.dts.pipe(gulp.dest('./build/src'));
  return tsResult.js.pipe(gulp.dest('./build/src'));
});

/**
 * Remove all generated JavaScript files from TypeScript compilation.
 */
gulp.task('clean', function(cb) {
  var typeScriptGenFiles = [ './build/' ] // path to generated JS files
      // delete the files
      del(typeScriptGenFiles, cb);
});

gulp.task('test.compile', [ 'compile' ], function(done) {
  if (hasError) {
    done();
    return;
  }
  return gulp.src([ 'test/**/*.ts', 'typings/**/*.d.ts' ], {base : '.'})
      .pipe(sourcemaps.init())
      .pipe(ts(tsProject))
      .on('error', onError)
      .js.pipe(sourcemaps.write())
      .pipe(gulp.dest('build/')); // '/test/' comes from base above.
});

gulp.task('unit.test', [ 'test.compile' ], function() {
  return gulp.src('build/test/unit/test.js', {read : false}).pipe(mocha({}));
});

gulp.task('watch', function() {
  gulp.watch([ './src/*.ts' ], [ 'compile', 'test.compile', 'unit.test' ]);
});

gulp.task('default', [ 'compile', 'unit.test', 'watch' ]);
