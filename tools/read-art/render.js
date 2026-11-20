const { chromium } = require('playwright');
const fs = require('fs'); const path=require('path');
(async () => {
  const scenes = JSON.parse(fs.readFileSync('scenes.json','utf8'));
  const out = process.argv[2]; fs.mkdirSync(out,{recursive:true});
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve('scenes.html'));
  for (const [id, sc] of Object.entries(scenes)) {
    for (const [suffix, W, H] of [['', 1290, 1000], ['-thumb', 360, 360]]) {
      const data = await p.evaluate(([sc,W,H]) => { draw(sc,W,H); return document.getElementById('c').toDataURL('image/jpeg', 0.82); }, [sc, W, H]);
      fs.writeFileSync(`${out}/${id}${suffix}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
    }
  }
  await b.close();
})();
