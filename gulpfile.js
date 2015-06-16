var gulp = require('gulp'),
    debug = require('gulp-debug'),
    inject = require('gulp-inject'),
    tsc = require('gulp-typescript'),
    tslint = require('gulp-tslint'),
    sourcemaps = require('gulp-sourcemaps'),
    del = require('del'),
    Config = require('./gulpfile.config');

var config = new Config();

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
    var sourceTsFiles = [config.allTypeScript,                //path to typescript files
                         config.libraryTypeScriptDefinitions]; //reference to library .d.ts files

    var tsResult = gulp.src(sourceTsFiles)
                       .pipe(sourcemaps.init())
                       .pipe(tsc({
                           target: 'es6',
                           declarationFiles: false,
                           noExternalResolve: true,
                           module: "commonjs"
                       }));

        tsResult.dts.pipe(gulp.dest(config.tsOutputPath));
        return tsResult.js
                        .pipe(sourcemaps.write('.'))
                        .pipe(gulp.dest(config.tsOutputPath));
});

/**
 * Remove all generated JavaScript files from TypeScript compilation.
 */
gulp.task('clean', function (cb) {
  var typeScriptGenFiles = [config.tsOutputPath,            // path to generated JS files
                            config.sourceApp +'**/*.js',    // path to all JS files auto gen'd by editor
                            config.sourceApp +'**/*.js.map' // path to all sourcemap files auto gen'd by editor
                           ];

  // delete the files
  del(typeScriptGenFiles, cb);
});

gulp.task('watch', function() {
    gulp.watch([config.allTypeScript], ['compile']);
});

gulp.task('default', ['compile', 'watch']);