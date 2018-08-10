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
const gulp = require('gulp');
const compodoc = require('@compodoc/gulp-compodoc');
const concat = require('gulp-concat');
const replace = require('gulp-replace');
const insert = require('gulp-insert');
const isDirectory = require('./utils.js').isDirectory;
const getDirectories = require('./utils.js').getDirectories;

const dappRelativePath = path.resolve(process.argv[process.argv.indexOf('--dapp') + 1]);
const documentationFolder = path.resolve(`${ dappRelativePath }/documentation`);
const projectFolders = [ dappRelativePath ];

gulp.task('concat-readme', function() {
  return gulp
    .src(projectFolders
      .map(folder => path.resolve(`${folder}/README.md`))
    )
    .pipe(insert.prepend('\n---\n'))
    .pipe(replace(/^#/gm, '##'))
    .pipe(concat(`README.md`))
    .pipe(insert.prepend('# Combined Documentation'))
    .pipe(gulp.dest(documentationFolder));
});

gulp.task('build-doc', [ 'concat-readme' ], function() {
  process.chdir(path.resolve(documentationFolder));

  console.dir(projectFolders
    .map(folder => path.resolve(`${folder}/src/**/*.ts`)))

  return gulp
    .src(projectFolders
      .map(folder => path.resolve(`${folder}/src/**/*.ts`))
    )
    .pipe(compodoc({
      output: path.resolve(documentationFolder),
      tsconfig: path.resolve(`${ dappRelativePath }/tsconfig.json`),
      serve: true,
      port: 4040
    }))
});
