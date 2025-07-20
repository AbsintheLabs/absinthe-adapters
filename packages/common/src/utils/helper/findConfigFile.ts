import fs from 'fs';
import path from 'path';

// Helper function to find the config file
export function findConfigFile(fileName: string): string {
  const possibleLocations = [
    fileName,
    './' + fileName,
    '../' + fileName,
    '../../' + fileName,
    '../../../' + fileName,
  ];

  for (const location of possibleLocations) {
    if (fs.existsSync(location)) {
      return location;
    }
  }

  const searchResult = searchForFile('abs_config.json', process.cwd(), 4);
  if (searchResult) {
    return searchResult;
  }

  throw new Error('Could not find abs_config.json file. Please make sure it exists.');
}

function searchForFile(filename: string, startDir: string, maxDepth: number): string | null {
  if (maxDepth <= 0) return null;

  const items = fs.readdirSync(startDir);

  for (const item of items) {
    const itemPath = path.join(startDir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isFile() && item === filename) {
      return itemPath;
    } else if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
      const found = searchForFile(filename, itemPath, maxDepth - 1);
      if (found) return found;
    }
  }

  return null;
}
