import { calculate } from "./cncEngine.js";
import { TOOL_TYPES, RADIUS_ENGAGEMENTS, PART_MATERIALS, OPERATIONS } from "./cncData.js";
let fails=0; const ok=(c,m)=>{ if(!c){console.log("FAIL:",m); fails++;} else console.log("ok:",m); };
const base={diameter:0.5,flutes:4,loc:0.75,toolMaterialId:"carbide",coatingId:"none",aggressiveness:0.6,machine:{hp:10,maxRpm:20000,minRpm:60,maxIpm:400},operationId:"2d_contour_rough"};
for (const id of ["corner_round","concave_radius","round_insert","bull_nose"]) ok(!!TOOL_TYPES.find(t=>t.id===id),"tool type "+id);
// every tool type x every material x every op computes without NaN
let bad=0;
for (const tid of ["corner_round","concave_radius","round_insert","bull_nose"]) for (const m of PART_MATERIALS) for (const op of OPERATIONS) {
  const r=calculate({...base,toolTypeId:tid,materialId:m.id,operationId:op.id,cornerRadius:0.0625,insertIc:0.25,flutes:tid==="round_insert"?2:4,featureDepth:0.5,threadId:"unc_1_4_20"});
  if(r.error) continue;
  if(![r.rpm,r.ipm,r.sfm,r.chipLoad,r.hpRequired].every(Number.isFinite)) bad++;
}
ok(bad===0,"radius cutters never produce NaN/Infinity across all materials x operations ("+bad+")");
// Corner rounding: Harvey effective diameter = pilot + R
const cr=calculate({...base,toolTypeId:"corner_round",materialId:"steel_1018",cornerRadius:0.0625});
ok(Math.abs(cr.effectiveDiameter-(0.375+0.0625))<0.002,"corner rounding D_eff = pilot + R = 0.4375 ("+cr.effectiveDiameter+")");
ok(Math.abs(cr.sfm-200*Math.min(1.3,Math.max(0.6,1))*1)<80,"corner rounding steel SFM near Harvey 200 ("+Math.round(cr.sfm)+")");
ok(cr.chipLoad>0.0014&&cr.chipLoad<0.0026,"corner rounding steel fz near Harvey 0.0016-0.0021 @0.375-0.5 ("+cr.chipLoad.toFixed(5)+")");
ok(cr.radiusCutter&&cr.radiusCutter.passes===3,"steel corner rounding: 3 passes");
ok(JSON.stringify(cr.radiusCutter.passSchedule)===JSON.stringify([0.025,0.025,0.0125]),"3-pass schedule .4R/.4R/.2R "+JSON.stringify(cr.radiusCutter.passSchedule));
const al=calculate({...base,toolTypeId:"corner_round",materialId:"alum_6061",cornerRadius:0.0625});
ok(al.radiusCutter.passes===1&&al.sfm>900&&al.sfm<1300,"aluminum corner rounding: 1 pass, SFM ~Harvey 1000 ("+Math.round(al.sfm)+")");
// R/pilot >= 2.5 uses 0.7R
const big=calculate({...base,diameter:0.5,toolTypeId:"corner_round",materialId:"alum_6061",cornerRadius:0.22});
ok(Math.abs(big.effectiveDiameter-(0.06+0.7*0.22))<0.002,"R/pilot>=2.5: D_eff = pilot+0.7R ("+big.effectiveDiameter+")");
// engagement multipliers (Harvey footnotes)
const both=calculate({...base,toolTypeId:"corner_round",materialId:"steel_1018",cornerRadius:0.0625,radiusEngagement:"both_sides"});
ok(Math.abs(both.chipLoad/cr.chipLoad-0.7)<0.02,"both sides: chip load x0.7");
const plunge=calculate({...base,toolTypeId:"corner_round",materialId:"steel_1018",cornerRadius:0.0625,radiusEngagement:"plunge"});
ok(plunge.chipLoad/cr.chipLoad<=0.5&&plunge.chipLoad/cr.chipLoad>=0.4,"plunge: chip load 40-50%");
// Concave: D_eff = D - 2R, engagement multipliers
const cc=calculate({...base,diameter:1.25,toolTypeId:"concave_radius",materialId:"steel_1018",cornerRadius:0.25});
ok(Math.abs(cc.effectiveDiameter-0.75)<0.002,"concave D_eff = D-2R = 0.75 ("+cc.effectiveDiameter+")");
const c1=calculate({...base,toolTypeId:"concave_radius",materialId:"alum_6061",cornerRadius:0.0625,radiusEngagement:"od_radius_one"});
const c2=calculate({...base,toolTypeId:"concave_radius",materialId:"alum_6061",cornerRadius:0.0625,radiusEngagement:"od_radius_both"});
const c3=calculate({...base,toolTypeId:"concave_radius",materialId:"alum_6061",cornerRadius:0.0625,radiusEngagement:"radius_one"});
const c4=calculate({...base,toolTypeId:"concave_radius",materialId:"alum_6061",cornerRadius:0.0625,radiusEngagement:"radius_both"});
ok(Math.abs(c2.chipLoad/c1.chipLoad-0.6)<0.02&&Math.abs(c3.chipLoad/c1.chipLoad-1.2)<0.02&&Math.abs(c4.chipLoad/c1.chipLoad-0.75)<0.02,"concave engagement x0.6 / x1.2 / x0.75");
// coated +15%
const co=calculate({...base,toolTypeId:"corner_round",coatingId:"altin",materialId:"steel_1018",cornerRadius:0.0625});
ok(Math.abs(co.chipLoad/cr.chipLoad-1.15)<0.02,"coated radius cutter: chip load +15% (Harvey 10-20%)");
// no radial thinning on form tools; spindle limited by actual D_eff
ok(cr.radialThinningFactor===1,"no radial chip-thinning on form profile");
ok(Math.abs(cr.rpm-cr.sfm*3.82/cr.effectiveDiameter)<6,"RPM from effective diameter");
// invalid / mid-typing geometry must NEVER return an error object (UI reads result.woc etc. every keystroke)
let crash=0;
for (const t of ["corner_round","concave_radius","round_insert","bull_nose"]) for (const v of [undefined,null,NaN,0,-1,1e-9,0.01,0.25,0.3,0.5,5,1e6]) for (const d of [0.25,0.5,1]) {
  const r=calculate({...base,diameter:d,toolTypeId:t,materialId:"steel_1018",cornerRadius:v,insertIc:v});
  if(r.error||![r.woc,r.doc,r.rpm,r.ipm,r.radialEngagementPct,r.radialThinningFactor,r.hpRequired].every(Number.isFinite)||!r.warnings) crash++;
}
ok(crash===0,"radius/IC garbage inputs never error or yield NaN ("+crash+")");
const oversize=calculate({...base,toolTypeId:"corner_round",materialId:"alum_6061",cornerRadius:0.3});
ok(!oversize.error&&oversize.warnings.some(w=>/too large/.test(w)),"oversize radius is clamped with a warning, not an error");
// Bull nose: D_eff below radius, unchanged above
const bn1=calculate({...base,flutes:2,toolTypeId:"bull_nose",materialId:"steel_1018",cornerRadius:0.0625,axialDoc:0.02});
const bn2=calculate({...base,flutes:2,toolTypeId:"bull_nose",materialId:"steel_1018",cornerRadius:0.0625,axialDoc:0.3});
ok(Math.abs(bn1.effectiveDiameter-((0.5-0.125)+2*Math.sqrt(0.02*(0.125-0.02))))<0.002,"bull nose D_eff at ap<r ("+bn1.effectiveDiameter+")");
ok(bn2.effectiveDiameter===0.5,"bull nose D_eff = D when ap >= r");
ok(bn1.chipLoad>bn2.chipLoad&&bn1.chipLoad/bn2.chipLoad<=2.01,"bull nose axial chip thinning raises fz (<=2x)");
// Round insert
const ri=calculate({...base,flutes:2,toolTypeId:"round_insert",materialId:"steel_1018",insertIc:0.25,axialDoc:0.03});
const exp=0.5-0.25+Math.sqrt(0.25*0.25-Math.pow(0.25-0.06,2));
ok(Math.abs(ri.effectiveDiameter-exp)<0.002,"round insert D_eff (Mentor) ("+ri.effectiveDiameter+" vs "+exp.toFixed(3)+")");
ok(ri.radiusCutter.axialThinning>1.3,"round insert axial thinning >1.3 at ap=0.12 IC");
ok(calculate({...base,toolTypeId:"round_insert",materialId:"steel_1018",insertIc:0.6}).warnings.some(w=>/must be smaller/.test(w)),"IC >= D clamped with warning");
// existing tools unaffected
const em=calculate({...base,toolTypeId:"end_mill",materialId:"steel_1018"});
ok(!em.radiusCutter&&em.effectiveDiameter===0.5,"square end mill untouched");
process.exit(fails?1:0);
