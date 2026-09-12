const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, 'app');
const publicDir = path.join(appDir, '(public)');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

const itemsToMove = [
  'about',
  'contact',
  'destinations',
  'experiences',
  'journal',
  'properties',
  'serviced-apartments-jaipur',
  'stays-in-sariska',
  'studios-in-alwar',
  'page.tsx',
  'layout.tsx'
];

itemsToMove.forEach(item => {
  const oldPath = path.join(appDir, item);
  const newPath = path.join(publicDir, item);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`Moved ${item}`);
  }
});

console.log('Migration complete.');
