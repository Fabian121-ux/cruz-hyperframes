import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const cfg=JSON.parse(fs.readFileSync("quote.config.json","utf8"));
const root=process.cwd();
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,"."+decodeURIComponent(req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 if(!fs.existsSync(file)){res.writeHead(404).end();return}
 res.setHeader("Content-Type", file.endsWith(".png")?"image/png":file.endsWith(".html")?"text/html":"application/octet-stream");
 res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(8123,"127.0.0.1",resolve));
const browser=await puppeteer.launch({executablePath:"/usr/bin/google-chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
try{
 const page=await browser.newPage();
 await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});
 await page.goto("http://127.0.0.1:8123",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__timelines?.main && [...document.images].every(i=>i.complete && i.naturalWidth>0));
 await page.evaluate(()=>document.fonts.ready);
 const report=await page.evaluate(()=>{
   const cfg=window.__quoteConfig,tl=window.__timelines.main;
   const quote=[...document.querySelectorAll(".word")].map(x=>x.textContent).join(" ");
   const states=[];
   for(let frame=0;frame<=150;frame++){
     tl.totalTime(frame/30,false);
     const m=new DOMMatrix(getComputedStyle(document.querySelector("#camera")).transform);
     const arm=new DOMMatrix(getComputedStyle(document.querySelector("#arm")).transform);
     states.push({x:m.e,y:m.f,scale:Math.hypot(m.a,m.b),arm:Math.atan2(arm.b,arm.a)*180/Math.PI});
   }
   const words=[...document.querySelectorAll(".word")].map(x=>({text:x.textContent,opacity:Number(getComputedStyle(x).opacity),box:{left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right,top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom}}));
   const emphasis=[...document.querySelectorAll(".emphasis")].map(x=>({text:x.textContent,color:getComputedStyle(x).color}));
   tl.totalTime(1.9,false);
   const openingOpacities=[...document.querySelectorAll(".word")].map(x=>Number(getComputedStyle(x).opacity));
   return {quote,states,words,emphasis,openingOpacities};
 });
 assert.equal(report.quote,cfg.quote);
 assert.equal(report.words.length,15);
 assert.ok(report.openingOpacities.every(n=>n===0),"Text must not precede its reveal");
 assert.ok(report.words.every(w=>w.opacity===1 && w.box.left>=0 && w.box.right<=1920 && w.box.top>=0 && w.box.bottom<=1080),"Completed words must be visible and in frame");
 assert.deepEqual(report.emphasis.map(e=>e.text),["impatience","indolence."]);
 assert.ok(report.emphasis.every(e=>e.color==="rgb(7, 142, 255)"));
 let maxMove=0,maxScale=0,maxArm=0;
 for(let i=1;i<report.states.length;i++){
   const a=report.states[i-1],b=report.states[i];
   maxMove=Math.max(maxMove,Math.hypot(b.x-a.x,b.y-a.y));
   maxScale=Math.max(maxScale,Math.abs(b.scale-a.scale));
   maxArm=Math.max(maxArm,Math.abs(b.arm-a.arm));
 }
 console.log("CONTINUITY_MEASUREMENTS", JSON.stringify({maxMove,maxScale,maxArm,firstFrames:report.states.slice(0,3)}));
 assert.ok(maxMove<3 && maxScale<.003 && maxArm<.3,"Camera or arm movement jumps between frames");
 fs.mkdirSync("renders/preview",{recursive:true});
 for(const t of [0,.5,1,1.5,2,2.5,3,3.5,4.9666667]){
   await page.evaluate(t=>window.__timelines.main.totalTime(t,false),t);
   await page.screenshot({path:"renders/preview/time-"+t.toFixed(3)+".png"});
 }
 fs.writeFileSync("renders/preview-validation.json",JSON.stringify({quote:report.quote,emphasis:report.emphasis,maxCameraPixelsPerFrame:maxMove,maxScalePerFrame:maxScale,maxArmDegreesPerFrame:maxArm,words:report.words},null,2));
 console.log("PREVIEW_VERIFIED",JSON.stringify({quote:report.quote,words:report.words.length,maxMove,maxScale,maxArm}));
}finally{await browser.close();server.close();}
