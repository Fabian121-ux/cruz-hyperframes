import fs from "node:fs";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
const file="renders/Quote-Enhanced.mp4";
assert.ok(fs.statSync(file).size>10000,"MP4 missing or empty");
const probe=JSON.parse(execFileSync("ffprobe",["-v","error","-count_frames","-show_streams","-show_format","-of","json",file],{encoding:"utf8"}));
const v=probe.streams.find(s=>s.codec_type==="video");
assert.equal(v.codec_name,"h264");
assert.equal(v.width,1920);assert.equal(v.height,1080);
assert.equal(v.avg_frame_rate,"30/1");
assert.equal(Number(v.nb_read_frames),150);
assert.ok(Math.abs(Number(probe.format.duration)-5)<.05);
const edit=JSON.parse(fs.readFileSync("quote-edit-report.json","utf8"));
if(edit.sourceHasAudio)assert.ok(probe.streams.some(s=>s.codec_type==="audio"),"Original audio missing");
execFileSync("ffmpeg",["-v","error","-xerror","-i",file,"-f","null","-"],{stdio:"inherit"});
const preview=JSON.parse(fs.readFileSync("renders/preview-validation.json","utf8"));
assert.equal(preview.quote,"There are two main human sins from which all the others derive: impatience and indolence.");
fs.writeFileSync("renders/video-validation.json",JSON.stringify(probe,null,2));
console.log("MP4_VERIFIED",JSON.stringify({file,width:v.width,height:v.height,fps:v.avg_frame_rate,frames:v.nb_read_frames,duration:probe.format.duration,quote:preview.quote}));
execFileSync("ffmpeg",["-y","-hide_banner","-loglevel","error","-i",file,"-vf","fps=2,scale=480:270,tile=5x2","-frames:v","1","renders/render-sheet.jpg"]);
execFileSync("ffmpeg",["-y","-hide_banner","-loglevel","error","-ss","4.9","-i",file,"-frames:v","1","renders/render-final.jpg"]);
execFileSync("ffmpeg",["-y","-hide_banner","-loglevel","error","-ss","1.5","-i",file,"-frames:v","1","renders/render-gesture.jpg"]);
for(const name of ["render-sheet","render-final","render-gesture"]){
 console.log("IMAGE_"+name+":"+fs.readFileSync("renders/"+name+".jpg").toString("base64"));
}
