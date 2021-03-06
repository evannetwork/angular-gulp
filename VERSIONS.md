# angular-gulp

## Next Version
### Features

### Fixes

### Deprecations


## Version 2.1.3
### Fixes
- update gulp build scripts to be compatible node 12


## Version 2.1.2
### Fixes
- remove custom agpl appendix


## Version 2.1.1
### Fixes
- add missing `{ allowEmpty: true }` flags for dapps without typescript files


## Version 2.1.0
### Fixes
- include angular-sass as base64Css directory to correctly include base image styles
- Use static glob-stream version


## Version 2.0.0
### Features
- Add seperated build job for `ui-angular-core-build` and `ui-angular-libs-build`
- use browserify and babel for building dapps

### Deprecations
- dapps folders need babel libs as peer dependencies


## Version 1.2.3
### Fixes
- NodeJS 10 compatibility


## Version 1.2.2
### Fixes
- enable preferBuiltins


## Version 1.2.1
### Fixes
- remove warnings from angular build rollup


## Version 1.2.0
### Features
- add rollup babelify for a better browser support (=>, \`, ... class will be transformed)
- copy js files into build folder for correct building


## Version 1.1.0
### Features
- correct installation documentation


## Version 1.0.2
### Features
- log errors correctly by building multiple dapps


## Version 1.0.1
### Features
- use @evan.network for package name and dependencies scopes
- add .npmignore
- rename *contractus* variables to *evan*
- rename bcc-core bundle to bcc
  - rename BCCCore to CoreRuntime
  - rename BCCProfile to ProfileRuntime
  - rename BCCBC to BCRuntime
- add code documentation
- remove angular-bc


## Version 0.9.0
- initial version