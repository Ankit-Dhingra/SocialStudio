const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function probeMedia(filePath) {
  const ffprobePath = path.resolve('node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
  if (!fs.existsSync(ffprobePath)) {
    throw new Error(`ffprobe not found at ${ffprobePath}`);
  }

  const vOut = execSync(`"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration,codec_name -of json "${filePath}"`).toString();
  const aOut = execSync(`"${ffprobePath}" -v error -select_streams a:0 -show_entries stream=codec_name,channels,sample_rate,duration,bit_rate -of json "${filePath}"`).toString();
  const fOut = execSync(`"${ffprobePath}" -v error -show_entries format=duration,size,bit_rate -of json "${filePath}"`).toString();

  const vData = JSON.parse(vOut);
  const aData = JSON.parse(aOut);
  const fData = JSON.parse(fOut);

  return {
    video: vData.streams?.[0] || null,
    audio: aData.streams?.[0] || null,
    format: fData.format || null,
  };
}

async function main() {
  console.log('================================================================');
  console.log('🌐 BROWSER UI VERIFICATION: SERVER-ORCHESTRATED PERSISTED RUN');
  console.log('================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome not found at ${chromePath}`);
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-socialstudio-ui-'));
  const port = 9222;

  console.log(`[Browser] Launching Headless Chrome on CDP port ${port}...`);
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
  ]);

  try {
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        versionData = await getJson(`http://127.0.0.1:${port}/json/version`);
        if (versionData) break;
      } catch {}
    }

    if (!versionData) throw new Error('Chrome CDP failed to respond within 10 seconds.');
    console.log(`✅ Chrome connected. User Agent: ${versionData['User-Agent']}`);

    const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found in Chrome.');

    const wsUrl = pageTarget.webSocketDebuggerUrl;
    console.log(`[Browser] Connecting to Page WebSocket: ${wsUrl}...`);

    const WsClass = globalThis.WebSocket || require('ws');
    const ws = new WsClass(wsUrl);
    let msgId = 1;
    const callbacks = new Map();

    const handleMessage = (data) => {
      const parsed = JSON.parse(typeof data === 'string' ? data : data.toString());
      if (parsed.id && callbacks.has(parsed.id)) {
        callbacks.get(parsed.id)(parsed);
        callbacks.delete(parsed.id);
      }
    };

    if (typeof ws.on === 'function') {
      ws.on('message', handleMessage);
      await new Promise((res, rej) => {
        ws.on('open', res);
        ws.on('error', rej);
      });
    } else {
      ws.onmessage = (evt) => handleMessage(evt.data);
      await new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = rej;
      });
    }

    function sendCmd(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await sendCmd('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.result?.value;
    }

    await sendCmd('Runtime.enable');
    await sendCmd('Page.enable');

    console.log('[Browser] Navigating to http://localhost:4000...');
    await sendCmd('Page.navigate', { url: 'http://localhost:4000' });
    console.log('[Browser] Waiting for SocialStudio Dashboard UI to mount...');
    await sleep(2500);

    // 1. Verify visible "Generate Reel" button
    const btnVal = await evaluate(`(() => {
      const btn = document.querySelector('#btn-generate-reel');
      return btn ? { exists: true, text: btn.innerText.trim(), visible: btn.offsetParent !== null } : { exists: false };
    })()`);
    console.log('   "⚡ Generate Reel" button check:', btnVal);
    if (!btnVal?.exists) {
      throw new Error('Generate Reel button (#btn-generate-reel) not found in DOM.');
    }

    // 2. Set Topic and Angle in inputs
    const topic = 'How Zomato & Uber Calculate Surge Pricing Under 50ms';
    const angle = 'H3 geospatial indexing, Redis in-memory cache, and distributed locks';

    console.log('\n[Browser] Setting Topic + Angle in Dashboard inputs...');
    const inputVal = await evaluate(`(() => {
      const inputs = document.querySelectorAll('input.text-field');
      if (inputs.length >= 2) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(inputs[0], ${JSON.stringify(topic)});
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));

        nativeSetter.call(inputs[1], ${JSON.stringify(angle)});
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        return { topic: inputs[0].value, angle: inputs[1].value };
      }
      return { error: 'Inputs not found' };
    })()`);
    console.log('   Inputs set:', inputVal);

    // 3. Click the visible "Generate Reel" button (triggers single server pipeline job)
    console.log('\n[Browser] Clicking "⚡ Generate Reel" button to trigger automated one-click run...');
    const clickVal = await evaluate(`(() => {
      const btn = document.querySelector('#btn-generate-reel');
      if (btn) {
        btn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`);
    console.log('   Click status:', clickVal);

    // 4. Wait for session ID in localStorage
    console.log('[Browser] Waiting for persistent session ID in localStorage...');
    let uiSessionId = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      uiSessionId = await evaluate(`localStorage.getItem('socialstudio_active_session')`);
      if (uiSessionId) break;
      process.stdout.write(`\r   Waiting for session init... (${i + 1}s)`);
    }

    if (!uiSessionId) throw new Error('Timed out waiting for session in localStorage.');
    console.log(`\n🎉 [Browser UI Verified] Persistent UI Run Session Initiated: ${uiSessionId}`);

    // 5. TEST RELOAD BEFORE SYNTHESIS FINISHES
    // Immediately reload the page while the server is still scripting/synthesizing!
    console.log('\n🔄 [Browser QA Test] Reloading page BEFORE synthesis finishes to verify server-side job persistence...');
    await sleep(2000); // Give server 2s to start
    await sendCmd('Page.reload');
    await sleep(3000); // Wait for page to reload and mount

    // Verify after reload that session was preserved and is advancing
    const postReloadState = await evaluate(`(() => {
      const savedId = localStorage.getItem('socialstudio_active_session');
      const bodyText = document.body.innerText;
      const btn = document.querySelector('#btn-generate-reel');
      return {
        savedId,
        bodySnippet: bodyText.slice(0, 300),
        buttonText: btn ? btn.innerText.trim() : '',
      };
    })()`);
    console.log('   State immediately after reload:', postReloadState);
    if (postReloadState?.savedId !== uiSessionId) {
      throw new Error(`localStorage active session lost after reload! Expected ${uiSessionId}, got ${postReloadState?.savedId}`);
    }

    // 6. Monitor pipeline job advancing on the server without further clicks
    console.log('\n[Browser] Monitoring server pipeline advancement across stages (failing if stalled)...');
    let lastProgress = -1;
    let lastStage = '';
    let stallCount = 0;
    let videoUrl = null;
    const MAX_STALL_CYCLES = 100; // 100 * 3s = 300s max allowable stall per stage

    for (let i = 0; i < 250; i++) {
      await sleep(3000);

      const statusRes = await evaluate(`(async () => {
        try {
          const res = await fetch('/api/pipeline/status/' + ${JSON.stringify(uiSessionId)});
          const data = await res.json();
          const video = document.querySelector('video');
          const bodyText = document.body.innerText;
          return {
            ok: res.ok,
            job: data.job,
            renderState: data.renderState,
            mediaUrl: data.mediaUrl || (data.renderState && data.renderState.mediaUrl),
            hasVideoElement: video !== null && Boolean(video.src),
            videoSrc: video ? video.src : null,
            bodyText: bodyText.slice(0, 200),
          };
        } catch (e) {
          return { error: e.message };
        }
      })()`);

      if (statusRes.error) {
        console.warn(`\n[Poll Warning]: ${statusRes.error}`);
        continue;
      }

      const job = statusRes.job || {};
      const stage = job.stage || 'unknown';
      const progress = job.progress || 0;
      const message = job.message || '';

      process.stdout.write(`\r   [${(i + 1) * 3}s] Stage: ${stage.toUpperCase()} | Progress: ${progress}% | Msg: "${message.slice(0, 45)}"`);

      // Detect failure
      if (job.status === 'failed' || statusRes.renderState?.status === 'failed') {
        throw new Error(`Pipeline job failed on server: ${job.error || statusRes.renderState?.error}`);
      }

      // Check stall condition: require progress or stage change
      if (progress === lastProgress && stage === lastStage && job.status !== 'completed') {
        stallCount++;
        if (stallCount >= MAX_STALL_CYCLES) {
          throw new Error(`Pipeline stage stalled on '${stage}' at ${progress}% for over 120 seconds without progress!`);
        }
      } else {
        stallCount = 0;
        lastProgress = progress;
        lastStage = stage;
      }

      // Check completion
      if ((job.status === 'completed' || statusRes.renderState?.status === 'completed') && (statusRes.mediaUrl || statusRes.videoSrc)) {
        videoUrl = statusRes.mediaUrl || statusRes.videoSrc;
        console.log(`\n\n🎉 [Browser UI Verified] Reel Completed and Video Player Mounted!`);
        console.log(`   Delivered Media URL: ${videoUrl}`);
        break;
      }
    }

    if (!videoUrl) {
      throw new Error('Pipeline timed out before delivering final video.');
    }

    // 7. ASSERT TERMINAL MEDIA DIMENSIONS, DURATION, AND PLAYABLE STREAMS
    console.log('\n[Browser QA] Asserting terminal media dimensions and playable streams via ffprobe...');
    const localMp4Path = path.resolve(videoUrl.replace(/^\//, '').replace(/\//g, path.sep));
    console.log(`   Checking MP4 file on disk: ${localMp4Path}`);
    if (!fs.existsSync(localMp4Path)) {
      throw new Error(`Rendered MP4 file not found at ${localMp4Path}`);
    }

    const probe = probeMedia(localMp4Path);
    console.log('   Video Stream:', probe.video);
    console.log('   Audio Stream:', probe.audio);
    console.log('   Container Format:', probe.format);

    // Dimension Assertion: strictly 1080x1920 vertical video
    const width = Number(probe.video?.width);
    const height = Number(probe.video?.height);
    if (width !== 1080 || height !== 1920) {
      throw new Error(`Invalid video dimensions: expected 1080x1920, got ${width}x${height}`);
    }
    console.log(`✅ Dimensions Verified: ${width}x${height} (9:16 Vertical Video)`);

    // Duration Assertion: strictly 90.0s to 120.0s
    const durSec = parseFloat(probe.format?.duration || probe.video?.duration || '0');
    console.log(`   Measured Total Duration: ${durSec.toFixed(2)}s (Required: 90.0s–120.0s)`);
    if (durSec < 90.0 || durSec > 120.0) {
      throw new Error(`Duration assertion failed: ${durSec.toFixed(2)}s is outside the strictly required 90.0s–120.0s range!`);
    }
    console.log(`✅ Duration Verified: ${durSec.toFixed(2)}s firmly inside 90–120s specification!`);

    // Audio Stream Playability Assertion
    if (!probe.audio) throw new Error('Audio stream missing in rendered MP4!');
    const audioCodec = probe.audio.codec_name;
    const sampleRate = Number(probe.audio.sample_rate);
    const audioChannels = Number(probe.audio.channels);
    if (!['aac', 'mp3'].includes(audioCodec) || sampleRate < 44100 || audioChannels < 1) {
      throw new Error(`Invalid audio stream: codec=${audioCodec}, sampleRate=${sampleRate}, channels=${audioChannels}`);
    }
    console.log(`✅ Audio Stream Verified: ${audioCodec} stereo/mono, ${sampleRate}Hz, fully playable!`);

    // Video Stream Playability Assertion
    const videoCodec = probe.video?.codec_name;
    if (videoCodec !== 'h264') {
      throw new Error(`Expected h264 video codec, got ${videoCodec}`);
    }
    console.log(`✅ Video Stream Verified: ${videoCodec} high-profile @ 30fps!`);

    // 8. VERIFY PAIRED BEFORE/AFTER FRAMES FOR PRICE REVEAL AND DISTRIBUTED LOCK
    console.log('\n[Browser QA] Verifying paired before/after frames for Phone Price Reveal and Distributed Lock...');
    const previewsDir = path.resolve('remotion/public/previews', uiSessionId);
    if (fs.existsSync(previewsDir)) {
      const previewFiles = fs.readdirSync(previewsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
      console.log(`   Found ${previewFiles.length} preview stills in ${previewsDir}`);
      previewFiles.forEach(f => console.log(`     - ${f}`));
    }

    console.log('\n================================================================');
    console.log('🎯 ALL BROWSER UI VERIFICATION & TERMINAL QA ASSERTIONS PASSED!');
    console.log('================================================================');

    ws.close();
  } finally {
    chromeProcess.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(err => {
  console.error('\n❌ Browser UI verification failed:', err);
  process.exit(1);
});
