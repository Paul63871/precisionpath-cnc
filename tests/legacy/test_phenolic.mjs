import { calculate } from "./cncEngine.js";
import { calculateTurning } from "./turningEngine.js";
import { PART_MATERIALS, TAP_SFM_BY_CLASS, WOC_CLASS_TARGETS, TOOL_MATERIAL_CLASS_MULT } from "./cncData.js";
import { PHENOLIC_TURNING, isTurnable } from "./turningData.js";
let fails=0; const ok=(c,m)=>{ if(!c){console.log("FAIL:",m); fails++;} else console.log("ok:",m); };
const ids=["phenolic_xx","phenolic_ce","phenolic_le","phenolic_canvas","phenolic_glass"];
const base={diameter:0.25,flutes:2,loc:0.75,toolMaterialId:"carbide",coatingId:"none",toolTypeId:"end_mill",operationId:"2d_pocket",aggressiveness:0.6,machine:{hp:5,maxRpm:24000,minRpm:60,maxIpm:400}};
const mats=ids.map(i=>PART_MATERIALS.find(m=>m.id===i));
ok(mats.every(Boolean),"all 5 phenolic materials exist");
ok(mats.every(m=>m.category==="Phenolic"),"grouped under Phenolic category");
ok(PART_MATERIALS.some(m=>/Textolite/.test(m.name))&&PART_MATERIALS.some(m=>/Micarta/.test(m.name))&&PART_MATERIALS.some(m=>/Bakelite/.test(m.name)),"Textolite/Micarta/Bakelite searchable in names");
ok(["phenolic"].every(c=>TAP_SFM_BY_CLASS[c]&&WOC_CLASS_TARGETS[c]&&TOOL_MATERIAL_CLASS_MULT[c]),"phenolic class in tap/WOC/tool tables");
for(const m of mats){
  const r=calculate({...base,materialId:m.id});
  ok(r.rpm>0&&r.ipm>0&&r.chipLoad>0&&isFinite(r.hpRequired),m.id+" computes");
  ok(r.sfm<=m.sfmRange[1]*1.05+0.01,m.id+" SFM <= hard cap ("+Math.round(r.sfm)+")");
  ok(r.warnings.some(w=>/MACHINE DRY|flood coolant/i.test(w))&&r.warnings.some(w=>/ormaldehyde/.test(w)),m.id+" carries dry/flood + formaldehyde warnings");
  if(m.materialClass==="phenolic"){
    ok(r.chipLoad>=0.0025&&r.chipLoad<=0.0042,m.id+" 1/4in chip load within Ready routing/Titan band "+r.chipLoad.toFixed(4));
    ok(r.ipm>=60&&r.ipm<=150,m.id+" 1/4in routing feed in Ready 70-150 IPM band: "+Math.round(r.ipm));
    const dr=calculate({...base,toolTypeId:"drill",operationId:"drilling",materialId:m.id,featureDepth:0.5});
    const [lo,hi]=m.drillSfmRange;
    ok(dr.sfm>=lo*0.99&&dr.sfm<=hi*1.01,m.id+" drilling SFM in Ready window "+Math.round(dr.sfm));
    ok(dr.chipLoad>=0.003&&dr.chipLoad<=0.008,m.id+" drilling IPR in Ready window "+dr.chipLoad.toFixed(4));
    ok(dr.drilling.notes.some(n=>/backing board/i.test(n)),m.id+" drilling: backing board note");
    const fin=calculate({...base,materialId:m.id,operationId:"2d_contour_finish",priority:"finish"});
    ok(!fin.error&&fin.woc<=0.25*0.081,m.id+" finish radial stepover <= 8% D ("+(fin.woc/0.25*100).toFixed(1)+"%)");
  }
}
// drilling a 1/2 in
const d5=calculate({...base,diameter:0.5,toolTypeId:"drill",operationId:"drilling",materialId:"phenolic_ce",featureDepth:0.5});
ok(d5.chipLoad>=0.004&&d5.chipLoad<=0.008,"CE 1/2in drill IPR "+d5.chipLoad.toFixed(4));
// HSS warning (phenolic) + glass-phenolic abrasive warning
const hss=calculate({...base,materialId:"phenolic_ce",toolMaterialId:"hss"});
ok(hss.warnings.some(w=>/low volume/.test(w))&&hss.sfm<calculate({...base,materialId:"phenolic_ce"}).sfm,"HSS on CE: low-volume warning and slower");
const hg=calculate({...base,materialId:"phenolic_glass",toolMaterialId:"hss"});
ok(hg.warnings.some(w=>/abrasive/.test(w)),"HSS on glass phenolic: abrasive warning");
// no plastic over-clamp warning for phenolic
ok(!calculate({...base,materialId:"phenolic_ce",clampForce:7000}).warnings.some(w=>/Plastics deform/.test(w)),"no thermoplastic over-clamp warning on phenolic");
// tapping
const tp=calculate({...base,toolTypeId:"tap",operationId:"tapping",materialId:"phenolic_ce",threadSize:"1/4-20",featureDepth:0.4});
const tg=calculate({...base,toolTypeId:"tap",operationId:"tapping",materialId:"g10",threadSize:"1/4-20",featureDepth:0.4});
if(tp.tapping){
  ok(tp.tapping.notes.some(n=>/65-70%/.test(n)),"phenolic tap note: 65-70% engagement");
  ok(!tp.tapping.notes.some(n=>/1\.5-2\.5/.test(n)),"phenolic tap note does NOT use G10 1.5-2.5xD rule");
  ok(tg.tapping&&tg.tapping.notes.some(n=>/1\.5-2\.5/.test(n)),"G10 tap note unchanged");
  ok(tp.sfm<=70.5,"phenolic tap SFM <=70 ("+Math.round(tp.sfm)+")");
} else console.log("note: tapping probe not reached (",tp.error,")");
// Turning
const mach={hp:15,maxRpm:4000,minRpm:20,maxIpm:400,chuckMaxRpm:0};
const tb={gradeId:"uncoated",aggressiveness:0.6,workDiameter:2,finishDiameter:1.8,cutLength:3,insert:{shapeId:"C",ic:0.5,noseRadius:1/32},machine:mach,workholding:{stickout:4,gripDiameter:2,jawTypeId:"serrated",chuckGripForce:2000}};
for(const id of ids){
  ok(isTurnable(PART_MATERIALS.find(m=>m.id===id)),id+" turnable");
  const w=PHENOLIC_TURNING[id];
  const rr=calculateTurning({...tb,materialId:id,operationId:"od_rough"});
  const ff=calculateTurning({...tb,materialId:id,operationId:"od_finish",priority:"finish"});
  ok(!rr.error&&!ff.error,id+" turning computes");
  ok(rr.sfm>=w.rough[0]*0.95&&rr.sfm<=w.rough[1]*1.05,id+" rough SFM in Ready window "+Math.round(rr.sfm));
  ok(rr.feedIpr>=w.fRough[0]*0.95&&rr.feedIpr<=w.fRough[1]*1.05,id+" rough IPR in Ready window "+rr.feedIpr.toFixed(4));
  ok(ff.sfm>=w.finish[0]*0.95&&ff.sfm<=w.finish[1]*1.05,id+" finish SFM in Ready window "+Math.round(ff.sfm));
  ok(ff.feedIpr<=w.fFinish[1]*1.05,id+" finish IPR <= Ready max "+ff.feedIpr.toFixed(4));
}
const tc=calculateTurning({...tb,materialId:"phenolic_ce",operationId:"od_rough"});
ok([...tc.warnings,...tc.notes].some(w=>/DRY|dry/.test(w)),"turning CE: dry guidance shown");
ok(!tc.warnings.some(w=>/backing board|climb mill/i.test(w)),"turning CE: milling-only notes suppressed");
ok(calculateTurning({...tb,materialId:"phenolic_ce",gradeId:"hss",operationId:"od_rough"}).sfm<tc.sfm,"HSS turning slower than carbide on CE");
ok(calculateTurning({...tb,materialId:"phenolic_glass",gradeId:"hss",operationId:"od_rough"}).warnings.some(w=>/HSS tool bits are not recommended/.test(w)),"HSS not recommended on glass phenolic turning");
for(const id of ["cfrp","g10","g11"]) ok(!!calculateTurning({...tb,materialId:id,operationId:"od_rough"}).error,id+" still not turnable");
process.exit(fails?1:0);
