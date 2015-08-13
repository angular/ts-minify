var gulp = require('gulp');
var mocha = require('gulp-mocha');
var typescript = require('typescript');
var tsc = require('gulp-typescript');
var del = require('del');
var exec = require('child_process').exec;

var clangFormat = require('clang-format');
var formatter = require('gulp-clang-format');

var TSC_OPTIONS = {
  module: "commonjs",
  noExternalResolve: false,
  declarationFiles: true,
  typescript: require('typescript'),
};

var tsProject = tsc.createProject(TSC_OPTIONS);

gulp.task('test.check-format', function() {
  return gulp.src(['*.js', 'src/**/*.ts', 'test/**/*.ts'])
      .pipe(formatter.checkFormat('file', clangFormat));
});

gulp.task('clean', function(callback) { del(['./build/'], callback); });

gulp.task('compile', function() {
  var sourceTsFiles = ['./src/*.ts'];

  var tsResult = gulp.src(sourceTsFiles).pipe(tsc(tsProject));

  tsResult.dts.pipe(gulp.dest('./build/src'));
  return tsResult.js.pipe(gulp.dest('./build/src'));
});

gulp.task('test.compile', ['compile'], function(done) {
  return gulp.src(['test/**/*.ts'], {base: '.'}).pipe(tsc(tsProject)).pipe(gulp.dest('build/'));
});

gulp.task('unit.test', ['test.compile'], function() {
  var mochaOptions = {};
  return gulp.src('build/test/unit/main_test.js', {read: false}).pipe(mocha(mochaOptions));
});

gulp.task('e2e.test', ['test.compile'], function() {
  var e2e = require('./build/test/e2e/small_e2e');
  e2e.runE2ETests();
});

gulp.task('watch', function() {
  gulp.watch(['./src/*.ts', './test/**/*.ts'], ['compile', 'test.compile', 'unit.test', 'e2e.test']);
});

gulp.task('default', ['compile', 'unit.test', 'e2e.test', 'watch']);
