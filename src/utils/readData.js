const fs = require('fs');
const path = require('path');

const readData = () => {
  const dataPath = path.join(__dirname, '../data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return data;
};

module.exports = readData;
