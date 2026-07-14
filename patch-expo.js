const fs = require('fs');
const path = require('path');

function patchFile(filePath, search, replace) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(search)) {
      content = content.replace(search, replace);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Patched ${filePath}`);
    } else {
      console.log(`Search string not found in ${filePath}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
}

// In Expo SDK 54, the dynamic import for metro config is located in @expo/metro-config
const loadConfigPath1 = path.join(__dirname, 'node_modules', '@expo', 'metro-config', 'build', 'loadMetroConfig.js');
const loadConfigPath2 = path.join(__dirname, 'node_modules', 'expo', 'node_modules', '@expo', 'metro-config', 'build', 'loadMetroConfig.js');
const loadConfigPath3 = path.join(__dirname, 'node_modules', 'metro-config', 'src', 'loadConfig.js');

const searchStr = `await import(resolvedConfigPath);`;
const replaceStr = `await import(require('url').pathToFileURL(resolvedConfigPath).href);`;

const searchStrMetro = `await import(absolutePath);`;
const replaceStrMetro = `await import(require('url').pathToFileURL(absolutePath).href);`;

patchFile(loadConfigPath1, searchStr, replaceStr);
patchFile(loadConfigPath2, searchStr, replaceStr);
patchFile(loadConfigPath3, searchStrMetro, replaceStrMetro);

console.log('Patch complete.');
