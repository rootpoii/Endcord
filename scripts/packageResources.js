const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const dist = path.join(__dirname, '../dist');
const outDir = path.join(__dirname, '../dist_compressed');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = ['patcher.js', 'preload.js', 'renderer.js', 'renderer.css'];
const XOR_KEY = 0x5A;

files.forEach(f => {
    const rawPath = path.join(dist, f);
    if (fs.existsSync(rawPath)) {
        const raw = fs.readFileSync(rawPath);
        const compressed = zlib.gzipSync(raw, { level: 9 });
        const masked = Buffer.alloc(compressed.length);
        for (let i = 0; i < compressed.length; i++) {
            masked[i] = compressed[i] ^ XOR_KEY;
        }
        fs.writeFileSync(path.join(outDir, f + '.gz'), masked);
    }
});
console.log('✅ Resources GZipped and XOR-masked successfully!');
