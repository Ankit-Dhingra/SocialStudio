const fs = require('fs');
const files = fs.readdirSync('media/sessions').filter(f => f.endsWith('.json'));
files.sort((a, b) => fs.statSync('media/sessions/' + b).mtimeMs - fs.statSync('media/sessions/' + a).mtimeMs);
const latest = files[0];
const s = JSON.parse(fs.readFileSync('media/sessions/' + latest));
console.log('Session ID:', s.id);
console.log('renderState:', s.renderState);
console.log('job:', s.job);
