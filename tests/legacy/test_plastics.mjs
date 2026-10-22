import { calculate } from "./cncEngine.js";
import { PART_MATERIALS } from "./cncData.js";
let fails=0; const ok=(c,m)=>{ if(!c){console.log("FAIL:",m); fails++;} else console.log("ok:",m); };
const base={diameter:0.5,flutes:2,loc:1,toolMaterialId:"carbide",coatingId:"none",toolTypeId:"end_mill",operationId:"2d_pocket",aggressiveness:0.6,machine:{hp:5,maxRpm:24000,minRpm:60,maxIpm:400}};
const plastics=PART_MATERIALS.filter(m=>m.materialClass==="plastic");
ok(plastics.length>=16,"at least 16 plastics ("+plastics.length+")");
for (const id of ["nylon66","nylon6_cast","nylon_gf30","uhmw","hdpe","polypropylene","pvc","ptfe","peek","peek_gf30","pei_ultem","pet_ertalyte","acrylic","delrin","abs","polycarbonate"]) {
  const m=PART_MATERIALS.find(x=>x.id===id); ok(!!m,"exists "+id); if(!m) continue;
  const r=calculate({...base,materialId:id});
  ok(r.rpm>0&&r.ipm>0&&r.chipLoad>0&&isFinite(r.hpRequired),id+" computes");
  ok(r.sfm<=m.sfmRange[1]*1.06,id+" SFM within published range");
  ok(r.warnings.some(w=>w.startsWith(m.name)),id+" carries material-specific notes");
}
// Harvey unfilled plastics chip load 1/2": ~2.68% D = 0.0134 per tooth
const r=calculate({...base,materialId:"nylon66"});
ok(r.chipLoad>0.003&&r.chipLoad<0.02,"nylon chip load plausible "+r.chipLoad);
const gf=calculate({...base,materialId:"nylon_gf30",toolMaterialId:"hss"});
ok(gf.warnings.some(w=>/abrasive/.test(w)&&/HSS|High/i.test(w)),"glass-filled + HSS warns abrasive");
const clamp=calculate({...base,materialId:"ptfe",clampForce:7000});
ok(clamp.warnings.some(w=>/Plastics deform/.test(w)),"high vise force on plastic warns");
process.exit(fails?1:0);
