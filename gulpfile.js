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
var shell = require('gulp-shell');

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

var TSC_OPTIONS = {
  module : "commonjs",
  noExternalResolve : false,
  declarationFiles : true,
  // noEmitOnError: true - currently not possible because TS doesn't recognize
  // ES6 collection like Map, WeakMap, etc
  // noImplicitAny: true,
  typescript : require('typescript'),
};

// ts.createProjects takes compiler options
var tsProject = ts.createProject(TSC_OPTIONS);

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
 * Remove all generated JavaScript files from TypeScript compilation.
 */
gulp.task('clean', function(cb) {
  var typeScriptGenFiles = [ './build/' ] // path to generated JS files
      // delete the files
      del(typeScriptGenFiles, cb);
});

/**
 * Compile TypeScript and include references to library and app .d.ts files.
 */
gulp.task('compile', function() {
  var sourceTsFiles = [
    './src/*.ts' // path to typescript files
    // './typings/**/*.ts'
  ]; // reference to library .d.ts files

  var tsResult = gulp.src(sourceTsFiles)
                     .pipe(sourcemaps.init())
                     .pipe(ts(tsProject));

  tsResult.dts.pipe(gulp.dest('./build/src'));
  return tsResult.js.pipe(gulp.dest('./build/src'));
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

/* Reformat the generated TS */
gulp.task('reformat', [ 'test.compile' ], function() {
  return gulp.src([ './test/input/*_renamed.ts' ], {read : false})
      .pipe(shell(['./node_modules/clang-format/index.js -i -style="file" ./test/input/*_renamed.ts']));
});

gulp.task('unit.test', [ 'test.compile', 'reformat' ], function() {
  return gulp.src('build/test/unit/test.js', {read : false}).pipe(mocha({}));
});

gulp.task('watch', function() {
  gulp.watch([ './src/*.ts', './test/**/*.ts' ], [ 'compile', 'test.compile', 'unit.test' ]);
});

gulp.task('default', [ 'compile', 'unit.test', 'watch' ]);
