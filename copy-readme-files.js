const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const readmePath = path.join(rootDir, 'README.md');
const configPath = path.join(rootDir, 'copy-config.json');

if (!fs.existsSync(configPath)) {
  console.error(`Config file not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const outputDir = path.resolve(rootDir, config.outputDir || 'exported');

if (!fs.existsSync(readmePath)) {
  console.error(`README.md not found in workspace root: ${readmePath}`);
  process.exit(1);
}

const readme = fs.readFileSync(readmePath, 'utf8');
const lines = readme.split(/\r?\n/);
let inSection = false;
const files = [];

for (const line of lines) {
  if (/^#+\s*List of Files to Export/i.test(line)) {
    inSection = true;
    continue;
  }
  if (inSection) {
    const match = line.match(/^[-*]\s+(.+)$/);
    if (match) {
      files.push(match[1].trim());
      continue;
    }
    if (/^#+\s+/.test(line)) {
      break;
    }
  }
}

if (!files.length) {
  console.error('No files were found under the "List of Files to Export" section in README.md.');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

let copiedCount = 0;
for (const fileName of files) {
  const sourcePath = path.join(rootDir, fileName);
  const destPath = path.join(outputDir, path.basename(fileName));

  if (!fs.existsSync(sourcePath)) {
    console.warn(`Skipped missing file: ${fileName}`);
    continue;
  }

  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied: ${fileName} -> ${path.relative(rootDir, destPath)}`);
  copiedCount += 1;
}

console.log(`Copied ${copiedCount} file(s) to ${outputDir}`);
