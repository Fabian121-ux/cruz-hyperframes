import fs from "node:fs";
import {execFileSync} from "node:child_process";

const cfg = JSON.parse(fs.readFileSync("quote.config.json", "utf8"));
if (cfg.source !== "Quote.mp4" || cfg.lines.join(" ") !== cfg.quote) {
  throw new Error("Source / exact quotation mismatch.");
}
for (const asset of ["character-body.png", "pointing-arm.png"]) {
  if (!fs.existsSync("quote-assets/" + asset)) throw new Error("Missing " + asset);
}
const meta = JSON.parse(execFileSync("ffprobe", ["-v","error","-show_streams","-show_format","-of","json","Quote.mp4"], {encoding:"utf8"}));
const hasAudio = meta.streams.some(s => s.codec_type === "audio");
const esc = s => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const words = cfg.quote.split(" ");
let wordIndex = 0;
const lines = cfg.lines.map((line, li) => {
  const content = line.split(" ").map(word => {
    const i = wordIndex++;
    const emphasis = /^(impatience|indolence)[.]?$/.test(word);
    return '<span id="word-' + i + '" class="word' + (emphasis ? ' emphasis' : '') + '">' + esc(word) + '</span>';
  }).join(" ");
  return '<div class="quote-line line-' + li + '">' + content + '</div>';
}).join("\n");
const c = cfg.character;
const t = cfg.text;
const duration = cfg.duration;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${cfg.width},height=${cfg.height}">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
*{box-sizing:border-box}html,body{margin:0;width:${cfg.width}px;height:${cfg.height}px;overflow:hidden;background:#000}
#root{position:relative;width:100%;height:100%;overflow:hidden;background:#000}
#camera{position:absolute;inset:0;transform-origin:0 0;will-change:transform}
#character{position:absolute;left:${c.x}px;top:${c.y}px;width:948px;height:1080px;transform:scale(${c.scale});transform-origin:0 0}
#body,#arm{position:absolute;left:0;top:0;width:948px;height:1080px;object-fit:contain}
#body{z-index:1}#arm{z-index:2;transform-origin:${c.armPivot[0]}px ${c.armPivot[1]}px}
#quote{position:absolute;left:${t.x}px;top:${t.y}px;width:${t.width}px;color:#fafafa;font-family:Arial,Helvetica,sans-serif;font-size:${t.fontSize}px;line-height:${t.lineHeight};font-weight:800;letter-spacing:-1.4px}
#opening-mark{position:absolute;left:-5px;top:-74px;color:${cfg.accent};font-size:146px;line-height:1;font-weight:900;opacity:0}
#top-rule{position:absolute;left:106px;right:8px;top:12px;height:4px;background:${cfg.accent};transform-origin:left center;opacity:0}
#quote-text{padding-top:76px;white-space:nowrap}
.quote-line{height:80px}
.line-3{height:118px;margin-top:18px}
.line-4{height:118px}
.word{display:inline-block;opacity:0;transform:translateY(15px);will-change:transform,opacity}
.emphasis{color:${cfg.accent};font-size:${t.emphasisSize}px;font-weight:900;letter-spacing:-2.5px}
#bottom-rule{height:3px;margin-top:36px;margin-right:80px;background:${cfg.accent};opacity:0;transform-origin:left center}
#closing-mark{position:absolute;right:0;bottom:-50px;font-size:112px;color:${cfg.accent};line-height:1;opacity:0}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="${cfg.width}" data-height="${cfg.height}" data-fps="${cfg.fps}">
 <div id="camera">
  <div id="character">
   <img id="body" class="clip" src="quote-assets/character-body.png" data-start="0" data-duration="${duration}" data-track-index="0">
   <img id="arm" class="clip" src="quote-assets/pointing-arm.png" data-start="0" data-duration="${duration}" data-track-index="1">
  </div>
  <div id="quote">
   <div id="opening-mark" aria-hidden="true">“</div><div id="top-rule"></div>
   <div id="quote-text">${lines}</div>
   <div id="bottom-rule"></div><div id="closing-mark" aria-hidden="true">”</div>
  </div>
 </div>
</div>
<script>
window.__timelines = window.__timelines || {};
const cfg = ${JSON.stringify(cfg)};
const tl = gsap.timeline({paused:true});
const camera = cfg.camera;
tl.set("#camera",{x:camera[0].x,y:camera[0].y,scale:camera[0].scale},0);
for(let i=1;i<camera.length;i++){
 const p=camera[i],prev=camera[i-1];
 tl.to("#camera",{x:p.x,y:p.y,scale:p.scale,duration:p.time-prev.time,ease:"sine.inOut"},prev.time);
}
tl.set("#arm",{rotation:cfg.character.initialArmAngle},0);
tl.to("#arm",{rotation:-2.5,duration:1,ease:"sine.inOut"},0);
tl.to("#arm",{rotation:0,duration:1,ease:"sine.inOut"},1);
tl.to("#arm",{rotation:.15,duration:1.5,ease:"sine.inOut"},2);
tl.to("#arm",{rotation:0,duration:1.5,ease:"sine.inOut"},3.5);
tl.set("#arm",{filter:"blur(0px)"},0);
tl.to("#arm",{filter:"blur(0.25px)",duration:.45,ease:"sine.inOut"},1);
tl.to("#arm",{filter:"blur(0px)",duration:.55,ease:"sine.inOut"},1.45);
tl.fromTo("#opening-mark",{opacity:0,y:10},{opacity:1,y:0,duration:.35,ease:"sine.inOut"},1.9);
tl.fromTo("#top-rule",{opacity:0,scaleX:.7},{opacity:1,scaleX:1,duration:.45,ease:"sine.inOut"},1.95);
const count=${words.length};
const reveal=cfg.reveal;
const spacing=(reveal.end-reveal.start-reveal.fade)/(count-1);
for(let i=0;i<count;i++){
 const start=reveal.start+i*spacing;
 tl.fromTo("#word-"+i,{opacity:0,y:15},{opacity:1,y:0,duration:reveal.fade,ease:"sine.inOut"},start);
}
tl.fromTo("#bottom-rule",{opacity:0,scaleX:.75},{opacity:1,scaleX:1,duration:.3,ease:"sine.inOut"},3.2);
tl.fromTo("#closing-mark",{opacity:0,y:8},{opacity:1,y:0,duration:.3,ease:"sine.inOut"},3.2);
window.__timelines.main=tl;
window.__quoteConfig=cfg;
</script>
</body></html>`;
fs.writeFileSync("index.html",html);
fs.writeFileSync("quote-edit-report.json",JSON.stringify({source:cfg.source,originalDuration:Number(meta.format.duration),sourceHasAudio:hasAudio,quote:cfg.quote,words:words.length,poseFrame:cfg.poseFrame,width:cfg.width,height:cfg.height,fps:cfg.fps,duration:cfg.duration,camera:cfg.camera,characterTechnique:"original raster layers, shoulder rotation, no optical flow, no final pose jump"},null,2));
console.log("QUOTE_COMPOSITION", JSON.stringify({source:cfg.source,words:words.length,duration,width:cfg.width,height:cfg.height,hasAudio}));
