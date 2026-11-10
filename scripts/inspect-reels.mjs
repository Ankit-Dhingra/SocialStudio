import https from 'node:https';

function fetchPage(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => resolve('Error: ' + err.message));
  });
}

async function run() {
  for (const url of ['https://www.instagram.com/reel/DewUkjOJsL0/', 'https://www.instagram.com/reel/DeCnTJYTWGa/']) {
    console.log('\n================================');
    console.log('Inspecting:', url);
    const html = await fetchPage(url);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    console.log('Title:', titleMatch ? titleMatch[1] : 'No title');

    const ogMatches = html.match(/<meta\s+(?:property|name)=["'](?:og:|twitter:|description)([^"']+)["']\s+content=["']([^"']*)["']/gi) || [];
    for (const m of ogMatches) {
      console.log('Meta:', m);
    }
  }
}

run();
