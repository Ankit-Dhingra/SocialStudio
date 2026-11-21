const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-ui-test-'));
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=${dir}`,
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const list = await getJson('http://127.0.0.1:9223/json/list');
    const page = list.find(t => t.type === 'page');

    const ws = new (require('ws'))(page.webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));

    let id = 1;
    const callbacks = new Map();
    ws.on('message', (d) => {
      const msg = JSON.parse(d);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg);
        callbacks.delete(msg.id);
      }
    });

    const send = (m, p = {}) => new Promise(res => {
      const i = id++;
      callbacks.set(i, res);
      ws.send(JSON.stringify({ id: i, method: m, params: p }));
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://localhost:4000' });
    await new Promise(r => setTimeout(r, 2000));

    const check = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          storageKey: localStorage.getItem('socialstudio_active_session'),
          bodyText: document.body.innerText.substring(0, 300)
        };
      })()`,
      returnByValue: true
    });
    console.log('Storage check:', check.result?.result?.value);

    ws.close();
  } finally {
    chrome.kill();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
})();
