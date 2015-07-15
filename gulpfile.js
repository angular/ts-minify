var gulp = require('gulp');
var debug = require('gulp-debug');
var inject = require('gulp-inject');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var Config = require('./gulpfile.config');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');
var merge = require('merge2');
var typescript = require('typescript');

var config = new Config();
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
  module: "commonjs",
  noExternalResolve: false,
  declarationFiles: true,
  // noEmitOnError: true - currently not possible because TS doesn't recognize ES6 collections 
  //                       like Map, WeakMap, etc
  // noImplicitAny: true,
  typescript: typescript,
};

// ts.createProjects takes compiler options
var tsProject = ts.createProject(COMPILER_OPTIONS);

/**
 * Lint all custom TypeScript files.
 */
gulp.task('lint', function () {
  return gulp.src(config.allTypeScript).pipe(tslint()).pipe(tslint.report('prose'));
});

/**
 * Compile TypeScript and include references to library and app .d.ts files.
 */
gulp.task('compile', function () {
  console.log("compiling");
  var sourceTsFiles = [config.allTypeScript,       //path to typescript files
             config.libraryTypeScriptDefinitions]; //reference to library .d.ts files

  var tsResult = gulp.src(sourceTsFiles)
          .pipe(sourcemaps.init())
          .pipe(ts({
            typescript: require('typescript'),
            target: 'es5',
            module: 'commonjs',
            declarationFiles: false,
            noExternalResolve: true
          }));

  tsResult.dts.pipe(gulp.dest(config.buildOutputPathJS));
  return tsResult.js
          .pipe(sourcemaps.write('.'))
          .pipe(gulp.dest(config.buildOutputPathJS));
});

/**
 * Remove all generated JavaScript files from TypeScript compilation.
 */
gulp.task('clean', function (cb) {
  var typeScriptGenFiles = [config.tsOutputPath, // path to generated JS files
              config.sourceApp +'**/*.js',       // path to all JS files auto gen'd by editor
              config.sourceApp +'**/*.js.map',   // path to all sourcemap files auto gen'd by editor
              config.buildOutputPath];
  // delete the files
  del(typeScriptGenFiles, cb);
});

gulp.task('test.compile', ['compile'], function(done) {
  if (hasError) {
    done();
    return;
  }
  return gulp.src(['test/**/*.ts', 'typings/**/*.d.ts'], {base: '.'})
      .pipe(sourcemaps.init())
      .pipe(ts(tsProject))
      .on('error', onError)
      .js.pipe(sourcemaps.write())
      .pipe(gulp.dest('build/'));  // '/test/' comes from base above.
});

gulp.task('unit.test', ['test.compile'], function() {
  return gulp.src('build/test/e2e/test.js', {read: false})
  .pipe(mocha({reporter: 'nyan'})); // unneccesary; for fun!
});

gulp.task('watch', function() {
  gulp.watch([config.allTypeScript], ['compile', 'test.compile', 'unit.test']);
});

gulp.task('default', ['compile', 'unit.test', 'watch']);
