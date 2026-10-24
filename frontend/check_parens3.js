const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
const lines = content.split('\n');
let parenBal = 0;
let braceBal = 0;
for (let i = 0; i < 4920; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '(') {
      console.log('(' + ' at line ' + (i+1));
    } else if (c === ')') {
      console.log(')' + ' at line ' + (i+1));
    } else if (c === '{') {
      console.log('{' + ' at line ' + (i+1));
    } else if (c === '}') {
      console.log('}' + ' at line ' + (i+1));
    }
  }
}
console.log('Done');