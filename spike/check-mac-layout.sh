#!/usr/bin/env bash
# Render the shipped shell on macOS. Only these temporary copies contain a mock camera.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${RUNNER_TEMP:-/tmp}/tawel-ui-preview"
mkdir -p "$DEST"
cp "$ROOT"/spike/mac.{html,css,js} "$DEST/"
cp "$ROOT"/spike/mac-i18n.js "$ROOT"/spike/diagnostics.js "$DEST/"
python3 - "$DEST" <<'PY'
from pathlib import Path
import sys
folder=Path(sys.argv[1]); html=(folder/'mac.html').read_text()
mock='''<script>window.__TAURI__={core:{invoke:async function(command){if(command==='native_snapshot')return {enabled:true,status:2,camera:'Microsoft LifeCam HD-3000',hintActive:false,snoozeUntil:null};return null;}},event:{listen:async function(){}}};</script>'''
for name in ['focus','settings']:
    check='''<script>window.addEventListener('load',()=>{TAB;setTimeout(()=>{document.documentElement.dataset.layout= document.documentElement.scrollWidth<=innerWidth ? 'pass' : 'overflow';},100);});</script>'''.replace('TAB',"document.getElementById('settingsTab').click()" if name=='settings' else '')
    (folder/(name+'.html')).write_text(html.replace('<script src="./diagnostics.js">',mock+'<script src="./diagnostics.js">').replace('</body>',check+'</body>'))
PY
# Bounded browser session. Chromium CLI can wait indefinitely on macOS runners.
npm install --prefix "$DEST" --no-audit --no-fund playwright@1.58.2
"$DEST/node_modules/.bin/playwright" install --with-deps chromium
node - "$DEST" <<'JS'
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const dest = process.argv[2];
const {chromium} = require(path.join(dest, 'node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless:true, timeout:30000});
  try {
    for (const view of ['focus','settings']) {
      const page = await browser.newPage({viewport:{width:620,height:760}, locale:'de-AT'});
      await page.goto(pathToFileURL(path.join(dest, view+'.html')).href, {waitUntil:'domcontentloaded',timeout:15000});
      await page.waitForFunction(() => document.documentElement.dataset.layout === 'pass', null, {timeout:10000});
      await page.getByRole('button', {name:'Pausieren',exact:true}).waitFor({state:'attached',timeout:10000});
      if (!(await page.content()).includes('Microsoft LifeCam HD-3000')) throw Error('Native state missing');
      await page.screenshot({path:path.join(dest,view+'.png'),fullPage:true});
      if (view === 'settings') {
        await page.emulateMedia({colorScheme:'dark'});
        await page.screenshot({path:path.join(dest,'settings-dark.png'),fullPage:true});
      }
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
JS
