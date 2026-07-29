const asar = require('./node_modules/@electron/asar');
const pkg = asar.extractFile('C:/Users/ewlle/AppData/Local/DiscordCanary/app-1.0.1051/resources/_app.asar', 'package.json');
console.log(pkg.toString());
