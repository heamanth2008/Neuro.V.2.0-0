const fs = require('fs');
const content = fs.readFileSync('C:/Users/G HEMANTH/OneDrive/Documents/class.html/anti/neuro-music-app/frontend/app.js', 'utf8');
let count = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '`') {
    console.log('Backtick at global offset', i, 'context:', JSON.stringify(content.substring(Math.max(0,i-30), i+30)));
    count++;
  }
}
console.log('Total backticks:', count);