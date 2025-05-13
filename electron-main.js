#!/usr/bin/env node


process.env.ELECTRON_APP_NAME = 'PopTerm';


process.argv.push('--name=PopTerm');


require('electron/cli.js'); 