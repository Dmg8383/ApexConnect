const fs = require('fs');
const path = require('path');
const https = require('https');

const dir = path.join(__dirname, 'assets', 'sounds');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

// Telegram's official open-source notification sounds (highly professional)
const sounds = {
  'send.m4a': 'https://raw.githubusercontent.com/DrKLO/Telegram/master/TMessagesProj/src/main/res/raw/sound_b.m4a',
  'receive.m4a': 'https://raw.githubusercontent.com/DrKLO/Telegram/master/TMessagesProj/src/main/res/raw/sound_a.m4a',
  'error.m4a': 'https://raw.githubusercontent.com/DrKLO/Telegram/master/TMessagesProj/src/main/res/raw/sound_a.m4a'
};

Object.entries(sounds).forEach(([filename, url]) => {
  const dest = path.join(dir, filename);
  
  // Create an empty file first so the Expo bundler doesn't crash during 'require'
  fs.writeFileSync(dest, '');

  const download = (targetUrl) => {
    https.get(targetUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location);
      } else if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`Successfully downloaded ${filename}`);
        });
      } else {
        console.error(`Failed to download ${filename}: HTTP ${res.statusCode}`);
      }
    }).on('error', (err) => {
      console.error(`Error downloading ${filename}: ${err.message}`);
    });
  };

  download(url);
});
