# angular-gulp
This project contains a collection of build and watch jobs for Anguler 5 evan.network featured DApps. You will get the following functionallities:

- build a single dapp
```sh
gulp --gulpfile node_modules/@evan.network/angular-gulp/dapps.js bc-build ~/path-to-dapp
```

- build and serve the blockchain-core / DBCP project and copy the result into the DApp runtime (for core deveploment)
```sh
bc-serve gulp --gulpfile node_modules/@evan.network/angular-gulp/dapps.js bc-build --serve
```

- buid a single dapp
```sh
dapp-build gulp --cwd . --gulpfile node_modules/@evan.network/angular-gulp/dapp.js build --dapp ~/path-to-dapp
```

- buid a single dapp's sass

```sh
dapp-sass gulp --cwd . --gulpfile node_modules/@evan.network/angular-gulp/dapp.js sass --dapp ~/path-to-dapp
```

- build all core frontend dapps (angular-core, angular-libs, angular-sass)
```sh
dapps-core-build gulp --cwd . --gulpfile node_modules/@evan.network/angular-gulp/dapps.js dapps-core-build
```

- serve all core frontend dapps and build them after changes (angular-core, angular-libs, angular-sass)
```sh
dapps-core-serve gulp --cwd . --gulpfile node_modules/@evan.network/angular-gulp/dapps.js dapps-core-build --serve ~/path-to-dapp
```

- build the automated documentation for a single DApp
```sh
doc-build gulp --cwd . --gulpfile node_modules/@evan.network/angular-gulp/documentation.js build-doc --dapp ~/path-to-dapp
```

## Installation
```sh
npm i angular-gulp
```
