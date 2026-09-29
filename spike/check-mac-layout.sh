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
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for VIEW in focus settings; do
  "$CHROME" --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --user-data-dir="$DEST/profile-$VIEW" --window-size=620,800 --virtual-time-budget=2500 \
    --screenshot="$DEST/$VIEW.png" --dump-dom "file://$DEST/$VIEW.html" > "$DEST/$VIEW-dom.html"
  python3 - "$DEST/$VIEW-dom.html" <<'PY'
import sys
from pathlib import Path
html=Path(sys.argv[1]).read_text()
assert 'data-layout="pass"' in html, 'UI overflows or did not render'
assert 'Microsoft LifeCam HD-3000' in html, 'Native state did not reach the shell'
assert 'Pausieren</button>' in html, 'Active shell still shows the start button'
PY
done
