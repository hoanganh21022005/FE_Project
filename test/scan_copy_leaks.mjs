import fs from 'node:fs';
import path from 'node:path';

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') walk(full, fileList);
    } else if (/\.(jsx|js)$/.test(file)) {
      fileList.push(full);
    }
  }
  return fileList;
}

const files = walk('src');
const bannedRegexes = [
  /['"`][^'"`]*\bbackend\b[^'"`]*['"`]/i,
  /['"`][^'"`]*\bendpoint\b[^'"`]*['"`]/i,
  /['"`][^'"`]*\bpayload\b[^'"`]*['"`]/i,
  /['"`][^'"`]*GET \/api\/[^'"`]*['"`]/i,
  /['"`][^'"`]*POST \/api\/[^'"`]*['"`]/i,
  /['"`][^'"`]*HTTP 40\d[^'"`]*['"`]/i,
  /['"`][^'"`]*chưa hỗ trợ api[^'"`]*['"`]/i,
  /['"`][^'"`]*theo api[^'"`]*['"`]/i,
  /['"`][^'"`]*từ api[^'"`]*['"`]/i,
  />[^<]*\bbackend\b[^<]*</i,
  />[^<]*\bendpoint\b[^<]*</i,
  />[^<]*GET \/api\/[^<]*</i,
  />[^<]*POST \/api\/[^<]*</i,
  />[^<]*chưa hỗ trợ api[^<]*</i,
  />[^<]*theo api[^<]*</i,
  />[^<]*từ api[^<]*</i,
];

let totalHits = 0;
const hits = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }
    for (const reg of bannedRegexes) {
      if (reg.test(line)) {
        hits.push({ file, lineNum: idx + 1, text: trimmed });
        totalHits++;
        break;
      }
    }
  });
}

console.log(`Found ${totalHits} potential copy leaks:`);
hits.forEach(h => console.log(`  ${h.file}:${h.lineNum} -> ${h.text}`));
