// Shared browser QA for the live room and the offline test UI.
const assert=require('node:assert/strict');
async function assertCareLayout(page,width,{desktop=false}={}) {
  const controls=page.locator('.pgb-actions [data-act]');
  await controls.first().waitFor();assert.equal(await controls.count(),4);
  const info=await controls.evaluateAll(nodes=>nodes.map(b=>{
    const r=b.getBoundingClientRect(),detail=b.querySelector('.pgb-action-detail'),label=b.querySelector('.pgb-action-label');
    const tile=b.closest('.pgb-care-tile'),meter=tile?.querySelector('meter');
    return {x:r.x,y:r.y,w:r.width,h:r.height,label:label?.textContent,detail:detail?.textContent,
      need:meter?.getAttribute('aria-label'),value:meter?.value,shownValue:tile?.querySelector('.pgb-need b')?.textContent,
      fits:detail&&detail.scrollWidth<=detail.clientWidth+1,disabled:b.disabled,opacity:getComputedStyle(b).opacity};
  }));
  assert.deepEqual(info.map(x=>x.label),['Feed','Clean','Play','Rest']);
  assert.deepEqual(info.map(x=>x.need),['Hunger','Hygiene','Mood','Energy']);
  assert.ok(info.every(x=>x.value===Number(x.shownValue)&&x.value>=0&&x.value<=100));
  // page or iframe (FrameLocator has no evaluate): ask the document through its root element
  assert.ok(await page.locator('html').evaluate(e=>e.scrollWidth<=e.ownerDocument.defaultView.innerWidth),'no horizontal overflow');
  assert.ok(info.every(x=>x.h>=(desktop?44:52)&&x.w>=65&&x.x>=0&&x.x+x.w<=width+1&&x.fits&&x.detail),JSON.stringify(info));
  assert.ok(info.every(x=>x.opacity==='1'),'cooldown explanations remain readable');
  assert.equal(info[0].y,info[1].y);
  if(desktop)assert.ok(info.every(x=>x.y===info[0].y),'four care controls across on desktop');
  else {
    assert.equal(info[2].y,info[3].y);assert.equal(info[0].x,info[2].x);assert.equal(info[1].x,info[3].x);
    assert.ok(info[2].y>=info[0].y+info[0].h+7,'mobile controls have two separated rows');
  }
  return info;
}
module.exports={assertCareLayout};
