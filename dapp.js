/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License along with this program.
  If not, see http://www.gnu.org/licenses/ or write to the

  Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA, 02110-1301 USA,

  or download the license from the following URL: https://evan.network/license/

  You can be released from the requirements of the GNU Affero General Public License
  by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts of it
  on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address: https://evan.network/license/
*/

const path = require('path');
const cleanCSS = require('gulp-clean-css');
const commonjs = require('rollup-plugin-commonjs');
const concat = require('gulp-concat');
const cssBase64 = require('gulp-css-base64');
const del = require('del');
const exec = require('child_process').exec;
const fs = require('fs');
const gulp = require('gulp');
const gulpWatch = require('gulp-debounced-watch');
const inlineResources = require('./inline-resources');
const ngc = require('@angular/compiler/bundles/compiler.umd');
const plumber = require('gulp-plumber');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const resolve = require('rollup-plugin-node-resolve');
const rollup = require('gulp-rollup');
const rollupSourcemaps = require('rollup-plugin-sourcemaps');
const rollupBuiltins = require('rollup-plugin-node-builtins');
const rollupGlobals = require('rollup-plugin-node-globals');
const runSequence = require('run-sequence');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const tsc = require('gulp-typescript');

const runFolder = process.cwd();
const dappRelativePath = process.argv[process.argv.indexOf('--dapp') + 1];
const runtimeExternalFolderName = dappRelativePath.split('/').pop();
const rootFolder = path.resolve(`${dappRelativePath}`);
const dappName = require(`${ rootFolder }/dbcp.json`).public.name;
const srcFolder = path.join(rootFolder, 'src');
const tmpFolder = path.join(rootFolder, '.tmp');
const buildFolder = path.join(rootFolder, 'build');
const distFolder = path.join(rootFolder, 'dist');
const devDappFolder = path.join(rootFolder, '..', '..', 'ui-dapp-browser', 'runtime', 'external');

let rolloutExternals = [
  'bcc-bc',
  'bcc',
  'bcc-profile',
  'angular-core',
  'angular-libs',
  'angularcore',
  'angularlibs',
  'dapp-browser',
  'smart-contracts'
];

if (dappName !== 'angularlibs') {
  rolloutExternals = rolloutExternals.concat([
    '@angular/core',
    '@angular/common',
    '@angular/router',
    '@angular/platform-browser',
    '@angular/platform-browser-dynamic',
    '@angular/compiler',
    '@ionic-native',
    '@ionic-native/status-bar',
    '@ionic-native/splash-screen',
    'ionic-angular',
    'ionic-angular/bundles',
    'rxjs'
  ]);
}

/**
 * 1. Delete /dist folder
 */
gulp.task('clean:dist', function () {
  // Delete contents but not dist folder to avoid broken npm links
  // when dist directory is removed while npm link references it.
  return deleteFolders([distFolder + '/**', '!' + distFolder]);
});

/**
 * 2. Clone the /src folder into /.tmp. If an npm link inside /src has been made,
 *    then it's likely that a node_modules folder exists. Ignore this folder
 *    when copying to /.tmp.
 */
gulp.task('copy:source', function () {
  return gulp.src([`${srcFolder}/**/*`, `!${srcFolder}/node_modules`])
    .pipe(gulp.dest(tmpFolder));
});

/**
 * 3. Inline template (.html) and style (.css) files into the the component .ts files.
 *    We do this on the /.tmp folder to avoid editing the original /src files
 */
gulp.task('inline-resources', function () {
  return Promise.resolve()
    .then(() => inlineResources(tmpFolder));
});


/**
 * 4. Run the Angular compiler, ngc, on the /.tmp folder. This will output all
 *    compiled modules to the /build folder.
 *
 *    As of Angular 5, ngc accepts an array and no longer returns a promise.
 */
gulp.task('ngc', function () {
  process.chdir(path.resolve(`${ rootFolder }`))

  let tsConfig;

  try {
    tsConfig = require(`${rootFolder}/tsconfig.json`);
  } catch(ex) {
    console.error('ts config not found, ngc will not run');

    return;
  }

  tsConfig.compilerOptions.rootDir = `${ rootFolder }/.tmp`;
  tsConfig.compilerOptions.baseUrl = `${ rootFolder }/.tmp`;

  fs.writeFileSync(`${ rootFolder }/.tmp/tsconfig.json`, JSON.stringify(tsConfig, null, 2));

  return gulp
    .src([
      `${rootFolder}/.tmp/**/*.ts`,
      `!${rootFolder}/.tmp/**/*.spec.ts`
    ])
    .pipe(plumber({
      errorHandler: function (err) {
        console.error('>>> [tsc] Typescript compilation failed'.bold.green);
        this.emit('end');
      }}))
    .pipe(sourcemaps.init())
    .pipe(tsc(tsConfig.compilerOptions))
    .pipe(sourcemaps.write({includeContent: true}))
    .pipe(gulp.dest(buildFolder));
});

/**
 * 6. Run rollup inside the /build folder to generate our UMD module and place the
 *    generated file into the /dist folder
 */
gulp.task('rollup:umd', function () {
  if (!fs.existsSync(`${buildFolder}/index.js`)) {
    console.error('index.js not found, file will not be bundled');

    return;
  }

  return gulp.src(`${buildFolder}/**/*.js`)
  // transform the files here.
    .pipe(sourcemaps.init())
    .pipe(rollup({

      // Bundle's entry point
      // See "input" in https://rollupjs.org/#core-functionality
      input: `${buildFolder}/index.js`,

      // Allow mixing of hypothetical and actual files. "Actual" files can be files
      // accessed by Rollup or produced by plugins further down the chain.
      // This prevents errors like: 'path/file' does not exist in the hypothetical file system
      // when subdirectories are used in the `src` directory.
      allowRealFiles: true,

      // A list of IDs of modules that should remain external to the bundle
      // See "external" in https://rollupjs.org/#core-functionality
      external: rolloutExternals,

      // Format of generated bundle
      // See "format" in https://rollupjs.org/#core-functionality
      format: 'umd',

      treeshake: true,

      // Export mode to use
      // See "exports" in https://rollupjs.org/#danger-zone
      exports: 'named',

      // The name to use for the module for UMD/IIFE bundles
      // (required for bundles with exports)
      // See "name" in https://rollupjs.org/#core-functionality
      name: dappName,

      // See "globals" in https://rollupjs.org/#core-functionality
      globals: {
        typescript: 'ts'
      },

      plugins:[
        resolve(),
        commonjs({
          // include: 'node_modules/angular-libs/node_modules/rxjs/**'
        }),
        rollupGlobals(),
        rollupBuiltins(),
        // analyze({ limit: 20 }),
        // cleanup()
        // rollupSourcemaps()
      ]
    }))

    // remove ionic view handling errors 
    .pipe(replace(/throw \'invalid views to insert\'\;/g, 'viewControllers = [ ];'))
    .pipe(replace(/throw \'no views in the stack to be removed\'\;/g, 'return true;'))
    .pipe(replace(/ti\.reject\(rejectReason\)\;/g, ''))
    .pipe(replace(/console.warn\("You(.*)\n(.*)root\ page\'\;/g, 'return;'))
    .pipe(replace(/if\ \(shouldRunGuardsAndResolvers\)\ \{/g, 'if (shouldRunGuardsAndResolvers && context.outlet) {'))
    .pipe(replace(/if\ \(isElementNode\(element\)\)\ \{/g, 'if (isElementNode(element) && this._fetchNamespace(namespaceId)) {'))
    .pipe(replace(/throw\ new\ Error\(\'Cannot\ activate\ an\ already\ activated\ outlet\'\)\;/g, ''))

    // fix ace is doing weird blob stuff
    // .pipe(replace(/if\ \(e\ instanceof\ window\.DOMException\)\ \{/g, 'if (true) {'))
    
    // save file
    .pipe(rename(`${dappName}.js`))
    //´.pipe(sourcemaps.write(`.`,{includeContent: true, sourceRoot: `${dappRelativePath}`}))
    .pipe(gulp.dest(distFolder));
});

/**
 * 6.5. Be sure that your library will expose it self to the window, it will not be exported
 */
gulp.task('concat-custom-js-libs', function() {
  return gulp
    .src([
      `${distFolder}/${dappName}.js`,
      `${rootFolder}/src/**/*.js`
    ])
    .pipe(concat(`${dappName}.js`))
    .pipe(gulp.dest(distFolder));
});

/**
 * 7. Copy all the files from /build to /dist, except .js files. We ignore all .js from /build
 *    because with don't need individual modules anymore, just the Flat ES module generated
 *    on step 5.
 */
gulp.task('copy:build', function () {
  return gulp.src([`${buildFolder}/**/*`, `!${buildFolder}/**/*.js`])
    .pipe(gulp.dest(distFolder));
});

/**
 * 8. Copy package.json from /src to /dist
 */
gulp.task('copy:manifest', function () {
  return gulp.src([`${srcFolder}/package.json`])
    .pipe(gulp.dest(distFolder));
});

/**
 * 9. Copy README.md from / to /dist
 */
gulp.task('copy:readme', function () {
  return gulp.src([path.join(rootFolder, 'README.MD')])
    .pipe(gulp.dest(distFolder));
});

gulp.task('copy-images', function() {
  return gulp.src([
    'png',
    'jpg',
    'svg',
    'jpeg',
    'gif',
  ].map(fileEnding => `${srcFolder}/**/*.${fileEnding}`))
  .pipe(gulp.dest(distFolder));
});

/**
 * 10. Delete /.tmp folder
 */
gulp.task('clean:tmp', function () {
  return deleteFolders([tmpFolder]);
});

/**
 * 11. Delete /build folder
 */
gulp.task('clean:build', function () {
  return deleteFolders([buildFolder]);
});

const parseEnsName = function(ens) {
  return ens.replace(/-/g, '');
};

/**
 * 12. Copy compiled file into dapp build folder
 */
gulp.task('copy-dbcp-build-files', function () {
  try {
    let dbcpConfig = require(`${rootFolder}/dbcp.json`);
    dbcpConfig = Object.assign(dbcpConfig.public, dbcpConfig.private);

    const ensName = parseEnsName(dappName);

    if (dbcpConfig && dbcpConfig.dapp && dbcpConfig.dapp.files) {
      // copy all files that are configured within the dbcp configuration, all map files and the 
      // dbcp.json config
      const filesToCopy = dbcpConfig.dapp.files.concat([ '*.js.map' ]);
      const destination = path.resolve(`${runFolder}/node_modules/@evan.network/ui-dapp-browser/runtime/external/${ensName}`);

      // delete old folder from external
      return deleteFolders([
        path.resolve(`${runFolder}/node_modules/@evan.network/ui-dapp-browser/runtime/external/${ensName}/**`)
      ])
      .then(() => new Promise((resolve, reject) => gulp
        .src(path.join(rootFolder, `dbcp.json`))
        .pipe(gulp.dest(path.resolve(`${ destination }`)))
        .on('end', () => resolve())
      ))
      // copy needed files for dbcp
      .then(async () => {
        for (let fileToCopy of filesToCopy) {
          let splittedFile = fileToCopy.split('/');
          let destinationSubFolder = '';
          let originalFilePath = path.join(rootFolder, `dist/${ fileToCopy }`);

          if (splittedFile.length > 1) {
            splittedFile.pop();
            
            destinationSubFolder = `/${ splittedFile.join('/') }`;
          }

          if (!fs.existsSync(originalFilePath)) {
            originalFilePath = path.join(rootFolder, `src/${ fileToCopy }`)
          }

          await new Promise((resolve, reject) => gulp
            .src(originalFilePath)
            .pipe(gulp.dest(path.resolve(`${ destination }${ destinationSubFolder }`)))
            .on('end', () => resolve())
          )
        }
      })
      .then(() => {
        const dbcp = {
          dbcpPath: `${rootFolder}/dbcp.json`
        }
        fs.writeFileSync(
          `${runFolder}/node_modules/@evan.network/ui-dapp-browser/runtime/external/${ensName}/dbcpPath.json`,
          JSON.stringify(dbcp)
        )
      })
    } else {
      return;
    }
  } catch(ex) {
    console.dir(ex);
    return;
  }
});

gulp.task('sass', function () {
  process.chdir(path.resolve(`${ rootFolder }`))

  let includePaths = [
    './..',
    './../../node_modules',
    './../../node_modules/ionic-angular/themes',
    './../../node_modules/ionic-angular/fonts',
    './../../node_modules/ionicons/dist/scss',
    './node_modules',
    './node_modules/ionic-angular/themes',
    './node_modules/ionic-angular/fonts',
    './node_modules/ionicons/dist/scss'
  ];

  includePaths = includePaths.concat(includePaths
    .map(includePath => includePath.replace('./node_modules', './node_modules/@evan.network/ui-angular-libs/node_modules'))
  );

  return gulp
    .src(`${rootFolder}/src/**/*.scss`)
    .pipe(
      sass({
        outputStyle : 'compressed',
        includePaths : includePaths.map(src => path.resolve(src))
      })
      .on('error', sass.logError)
    )
    // remove ttf and woff font files from build
    // file is 1,4mb big => to reduce file size, remove noto sans font files
    .pipe(replace(/(?:,\s?)?url\(\"[^"]*\"\) format\(\"(?:truetype|woff)\"\)(?:,\s?)?/g, ''))
    .pipe(replace(/\"Roboto\"\,\"Helvetica\ Neue\"\,sans\-serif/g, '\'Open Sans\', sans-serif'))
    .pipe(concat(`${dappName}.css`))
    .pipe(cssBase64({ maxWeightResource: 228000, baseDir : `dapps/${rootFolder}/src` }))
    .pipe(cssBase64({ maxWeightResource: 228000, baseDir : '../node_modules/ionic-angular/fonts' }))
    .pipe(cssBase64({ maxWeightResource: 228000, baseDir : '../node_modules/@evan.network/ui-angular-libs/node_modules/ionic-angular/fonts' }))
    .pipe(gulp.dest(distFolder));
});

gulp.task('compile', function () {
  runSequence(
    'clean:tmp',
    'clean:dist',
    'copy:source',
    'inline-resources',
    'ngc',
    'sass',
    'rollup:umd',
    'concat-custom-js-libs',
    'copy:build',
    'copy:manifest',
    'copy:readme',
    'copy-images',
    'clean:build',
    'clean:tmp',
    'copy-dbcp-build-files',
    function (err) {
      if (err) {
        console.log('ERROR:', err.message);
        deleteFolders([distFolder, tmpFolder, buildFolder]);
      } else {
        console.log('Compilation finished succesfully');
      }
    });
});

/**
 * Watch for any change in the /src folder and compile files
 */
gulp.task('watch', function () {
  gulpWatch(`${srcFolder}/**/*`, ['compile']);
});

gulp.task('clean', ['clean:dist', 'clean:tmp', 'clean:build']);

gulp.task('build', ['clean', 'compile']);
gulp.task('build:watch', ['build', 'compile', 'watch']);
gulp.task('default', ['build:watch']);

gulp.task('serve', ['clean', 'compile', 'watch']);

/**
 * Deletes the specified folder
 */
function deleteFolders(folders) {
  return del(folders, {
    force : true
  });
}
