const crypto = require('crypto')
const path = require('path');
const util = require('util'), fs = require('fs')
const mkdir = util.promisify(fs.mkdir);
const exec = util.promisify(require('child_process').exec);
//const { spawn, exec } = require('child_process');
//const ls = spawn('ls', ['-lh', '/usr']);

async function* walk(dir) {
    for await (const d of await fs.promises.opendir(dir)) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else if (d.isFile()) yield entry;
    }
}

// 
let stream = [];
const MAX_STREAM = 4;

// 
const timeout = (cb, interval) => () => new Promise(resolve => setTimeout(() => cb(resolve), interval))

// 
async function executeStream() {
    let waiting = [];
    for (let t of stream) {
        waiting.push(t())
    }
    stream = [];
    return (await Promise.race([
        Promise.all(waiting),
        timeout((resolve, reject) => {
            console.log("Warning! 'mapc' building too long...");
            return resolve(true);
            return reject(false);
        }, 1000)
    ]));
}

// Then, use it with a simple async for loop
async function main() {
    for await (const p of walk('./data/')) {
        if (path.extname(p) == ".map") {
            
            stream.push(async () => {
                try {
                    const { stdout, stderr } = await exec(`mapc ${p} ./data`);
                    console.log('stdout:', stdout);
                    console.log('stderr:', stderr);
                } catch (e) {
                    console.error(e); // should contain code (exit code) and signal (that caused the termination).
                }
            });
            
            if (stream.length >= MAX_STREAM) { await executeStream(); };
        }
    }
    await executeStream();
}

main()
