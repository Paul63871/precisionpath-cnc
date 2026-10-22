import { calculate } from "./cncEngine.js";
import { PART_MATERIALS, OPERATIONS, TOOL_TYPES } from "./cncData.js";
let fails=0; const ok=(c,m)=>{ if(!c){console.log("FAIL:",m); fails++;} else console.log("ok:",m); };
const mach={hp:10,maxRpm:12000,minRpm:60,maxIpm:400};
const base={diameter:0.5,flutes:3,loc:1.25,toolMaterialId:"carbide",coatingId:"altin",toolTypeId:"end_mill",materialId:"alum_6061",operationId:"2d_pocket",aggressiveness:0.6,machine:mach};
const cls=(c)=>PART_MATERIALS.find(m=>m.materialClass===c).id;
// ramp angle bands per class (Harvey / Anebon)
const bands={aluminum:[3,10],steel_mild:[1,3],stainless:[1,2],titanium:[1,2],plastic:[3,10],composite:[2,5],phenolic:[2,5],cast_iron:[1,3]};
for(const [c,[lo,hi]] of Object.entries(bands)){
  const r=calculate({...base,materialId:cls(c)});
  ok(r.entry&&r.entry.method==="helix",`${c}: helix entry default for pocket`);
  const a=r.entry.rampAngleDeg; ok(a>=lo-0.05&&a<=hi+0.05,`${c}: ramp ${a} deg inside ${lo}-${hi}`);
}
// pitch = pi*pathD*tan(angle) <= doc
{ const r=calculate({...base,helixDiameter:0.8}); const e=r.entry;
  const calc=Math.PI*e.pathDia*Math.tan(e.rampAngleDeg*Math.PI/180);
  ok(Math.abs(e.pathDia-0.3)<1e-3,"path dia = hole - tool");
  ok(e.pitchPerOrbit<=r.doc+1e-6,"pitch <= axial DOC");
  ok(Math.abs(calc-e.pitchPerOrbit)/e.pitchPerOrbit<0.02,"pitch = pi*pathD*tan(angle)");
  // entry feed 50% of fz (no thinning)
  ok(e.entryFpt<=r.chipLoad*0.5+1e-7,"entry fz <= 50% of chip load, with HP budget");
  ok(Math.abs(e.entryEdgeIpm-r.rpm*3*e.entryFpt)/e.entryEdgeIpm<0.02,"entry edge IPM = rpm*flutes*fz");
  ok(Math.abs(e.centerlineFactor-(0.8-0.5)/0.8)<1e-3,"centerline factor (Dh-D)/Dh");
  ok(Math.abs(e.rampFeed-e.entryEdgeIpm*e.centerlineFactor)<0.15,"ramp feed = edge x factor");
  ok(Math.abs(e.axialIprSpindle-e.axialFeedIpm/r.rpm)<1e-4,"axial IPR per spindle rev = Z feed/rpm");
}
// default helix 1.2D
{ const e=calculate(base).entry; ok(Math.abs(e.helixHoleDia-0.6)<1e-3,"default helix hole = 1.2 x D"); }
// small helix warns/clamps; huge helix slug warning
{ const r=calculate({...base,helixDiameter:0.51}); ok(r.entry.helixHoleDia>=0.525-1e-6,"helix below 1.05D clamped"); ok(r.warnings.some(w=>/cannot orbit/.test(w)),"warn cannot orbit"); }
{ const r=calculate({...base,helixDiameter:1.5}); ok(r.warnings.some(w=>/core slug/.test(w)),"warn slug when hole > 2D"); }
// ramp / plunge
{ const r=calculate({...base,entryMethod:"ramp"}); const e=r.entry; ok(e.method==="ramp"&&e.rampLength>0,"linear ramp length"); ok(Math.abs(e.rampFeed-e.entryEdgeIpm)<0.06,"ramp feed = edge feed"); }
{ const r=calculate({...base,entryMethod:"plunge"}); const e=r.entry; ok(e.plungeIpr<=r.chipLoad*3*0.5+2e-4,"plunge IPR <= chipload*flutes*0.5 under power cap"); ok(Math.abs(e.plungeIpm-e.plungeIpr*r.rpm)<0.2,"plunge IPM = IPR*rpm"); }
{ const r=calculate({...base,entryMethod:"predrilled"}); ok(r.entry.method==="predrilled"&&r.entry.rampFeed==null,"predrilled: no ramp feed"); }
ok(calculate({...base,operationId:"slotting"}).entry.method==="ramp","slot defaults to linear ramp");
// bore with pilot -> predrilled; solid -> helix
ok(calculate({...base,operationId:"2d_bore_rough",featureDiameter:1.0,pilotDiameter:0.4}).entry.method==="predrilled","bore w/ pilot predrilled");
{ const r=calculate({...base,operationId:"2d_bore_rough",featureDiameter:0.8}); ok(r.entry.method==="helix"&&r.circular.helixPitch===r.entry.pitchPerOrbit,"bore solid helix consistent with circular block"); }
// no entry
for(const op of ["2d_contour_finish","facing_rough","drilling","tapping","3d_parallel","thread","2d_adaptive_finish"]){
  const tool=(op==="drilling")?"drill":(op==="tapping")?"tap":"end_mill";
  const r=calculate({...base,operationId:op,toolTypeId:tool,threadId:"1/4-20"}); ok(r.entry==null,`${op}: no entry block`);
}
ok(calculate({...base,toolTypeId:"corner_round",cornerRadius:0.06,operationId:"2d_pocket"}).entry==null,"radius cutter: no entry");
// feed per rev
{ const r=calculate({...base,operationId:"2d_contour_rough"}); ok(Math.abs(r.feedPerRev-r.ipm/r.rpm)<2e-3,"feedPerRev = ipm/rpm"); }
{ const r=calculate({...base,toolTypeId:"drill",operationId:"drilling"}); ok(Math.abs(r.feedPerRev-r.chipLoad)<1e-3||r.feedPerRev>0,"drill feedPerRev present"); }
// fuzz
const junk=[undefined,NaN,0,-1,1e9,"x",null,Infinity];
const ops=OPERATIONS.map(o=>o.id); const mats=PART_MATERIALS.map(m=>m.id);
let bad=0;
for(const op of ops) for(const mid of mats.filter((_,i)=>i%4===0)) for(const hd of junk) for(const m of ["helix","ramp","plunge","predrilled",undefined,"bogus"]) {
  let r; try{ r=calculate({...base,materialId:mid,operationId:op,helixDiameter:hd,featureDiameter:hd,entryMethod:m,threadId:"1/4-20"}); }catch(e){ bad++; if(bad<4)console.log("THROW",op,mid,hd,m,e.message); continue; }
  if(r.error){ bad++; if(bad<4)console.log("ERR",op,mid,hd,m,r.error); continue; }
  const e=r.entry; if(e){ for(const k of ["rampAngleDeg","pitchPerOrbit","rampFeed","axialFeedIpm","entryEdgeIpm","turns","pathDia"]) if(e[k]!=null&&!Number.isFinite(e[k])){ bad++; if(bad<4)console.log("NaN",k,op,mid,hd,m,e[k]); } }
  if(r.feedPerRev!=null&&!Number.isFinite(r.feedPerRev)){bad++;}
}
ok(bad===0,`garbage-input fuzz clean (${bad} problems)`);
process.exit(fails?1:0);
