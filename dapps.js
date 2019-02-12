/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see http://www.gnu.org/licenses/ or
  write to the Free Software Foundation, Inc., 51 Franklin Street,
  Fifth Floor, Boston, MA, 02110-1301 USA, or download the license from
  the following URL: https://evan.network/license/

  You can be released from the requirements of the GNU Affero General Public
  License by purchasing a commercial license.
  Buying such a license is mandatory as soon as you use this software or parts
  of it on other blockchains than evan.network.

  For more information, please contact evan GmbH at this address:
  https://evan.network/license/
*/

const path = require('path');
const fs = require('fs');
const gulp = require('gulp');
const exec = require('child_process').exec;
const gulpWatch = require('gulp-debounced-watch');
const serveDapps = process.argv.indexOf('--serve') !== -1;
const isDirectory = require('./utils.js').isDirectory;
const getDirectories = require('./utils.js').getDirectories;

const running = { };

const buildSubDApp = (cwd, command, callback) => {
  if (running[command]) {
    running[command] = 'rebuild';

    if (callback) {
      return callback(cwd, command, callback);
    }
  } else {
    console.log(``);
    console.log(`running: ${cwd} : ${command}`);

    running[command] = true;
    return new Promise((resolve, reject) => {
      exec(command, {
        cwd: path.resolve(cwd)
      }, (err, stdout, stderr) => {
        if (stderr) {
          const err = stderr
            .split(/\n/)
            .filter(
              row => row.indexOf('The following options have been renamed') === -1 &&
                     row.indexOf('The \'this\' keyword is equivalent') === -1 && 
                     row.indexOf('treating it as an external dependency') === -1 && 
                     row.indexOf('No name was provided for external module') === -1 &&
                     row.indexOf('\'default\' is not exported by') === -1
            ).join('\n')

          console.error(err);
        }

        resolve();
      })
    })
    .then(() => {
      if (running[command] === 'rebuild') {
        console.log(`         rebuildung...`);

        running[command] = false;
        buildSubDApp(cwd, command, callback);
      } else {
        running[command] = false;

        console.log(`         finished...`);
        console.log(``);
      }

      if (callback) {
        return callback(cwd, command, callback);
      }
    })
  }
}

async function serveSubDApp(cwd, watch, command, callback) {
  if (serveDapps) {
    console.log(`watching: ${watch}`);

    gulpWatch(watch, () => buildSubDApp(cwd, command, callback));
  } else {
    await buildSubDApp(cwd, command, callback);
  }
};

async function buildAngularLibs() {
  await serveSubDApp(
    './', 
    [
      'node_modules/@evan.network/ui-angular-libs/src/**/*',
      'node_modules/@evan.network/ui-angular-libs/dbcp.json',
      'node_modules/@evan.network/ui-angular-sass/src/ionic.scss'
    ], 
    'npm run dapp-build node_modules/@evan.network/ui-angular-libs'
  );
}

async function buildAngularCore() {
  await serveSubDApp(
    './', 
    [
      'node_modules/@evan.network/ui-angular-core/src/**/*',
      'node_modules/@evan.network/ui-angular-core/dbcp.json',
      'node_modules/@evan.network/ui-angular-sass/src/**/*'
    ], 
    'npm run dapp-build node_modules/@evan.network/ui-angular-core'
  );
}

async function copyBlockchainCorebundles() {
  await new Promise((resolve, reject) => {
    gulp.src([
      `node_modules/@evan.network/smart-contracts-core/contracts/compiled.js`,
      `node_modules/@evan.network/smart-contracts-core/dbcp.json`,
    ])
    .pipe(gulp.dest('node_modules/@evan.network/ui-dapp-browser/runtime/external/smartcontracts'))
    .on('end', () => resolve());
  })

  const dbcp = {
    dbcpPath: path.resolve(`node_modules/@evan.network/smart-contracts-core/dbcp.json`)
  };

  fs.writeFileSync(
    'node_modules/@evan.network/ui-dapp-browser/runtime/external/smartcontracts/dbcpPath.json',
    JSON.stringify(dbcp)
  )

  return gulp.src([
    `node_modules/@evan.network/api-blockchain-core/bundles/**`
  ])
  .pipe(gulp.dest('node_modules/@evan.network/ui-dapp-browser/runtime/external'));
}

gulp.task('bc-build', async () => {
  await buildSubDApp(
    'node_modules/@evan.network/api-blockchain-core',
    'npm run build-contracts',
    copyBlockchainCorebundles
  );
  
  await serveSubDApp(
    'node_modules/@evan.network/api-blockchain-core/node_modules/@evan.network/dbcp',
    [
      'node_modules/@evan.network/api-blockchain-core/node_modules/@evan.network/dbcp/src/**/*.ts',
      '!node_modules/@evan.network/api-blockchain-core/node_modules/@evan.network/dbcp/src/**/*.spec.ts'
    ],
    'npm run build',
    () => {
      // first run, don't build bundles, only if dbcp was changed, build the new bundles
      if (serveDapps) {
        return buildSubDApp(
          'node_modules/@evan.network/api-blockchain-core',
          'npm run build-bundles',
          copyBlockchainCorebundles
        );
      }
    }
  );

  await serveSubDApp(
    'node_modules/@evan.network/api-blockchain-core',
    [
      'node_modules/@evan.network/api-blockchain-core/src/**/*.ts',
      '!node_modules/@evan.network/api-blockchain-core/src/**/*.spec.ts'
    ],
    'npm run build-bundles',
    copyBlockchainCorebundles
  );
})

gulp.task('dapps-core-build', async () => {
  await buildAngularLibs();
  await buildAngularCore();
});

gulp.task('ui-angular-core-build', async () => {
  await buildAngularCore();
});

gulp.task('ui-angular-libs-build', async () => {
  await buildAngularLibs();
});

gulp.task('dapps-build', async () => {
  const dapps = getDirectories(path.resolve('dapps'));
  
  for (let dappPath of dapps) {
    await serveSubDApp(
      './',  
      [
        `${dappPath}/src/**/*`,
        `${dappPath}/dbcp.json`
      ], 
      `npm run dapp-build "dapps/${dappPath.split('/').pop()}"`
    );
  }
});

