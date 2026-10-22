import { calculate } from "./cncEngine.js";
let fails=0; const ok=(c,m)=>{ if(!c){console.log("FAIL:",m); fails++;} else console.log("ok:",m); };
const base={diameter:0.5,flutes:3,loc:1,toolMaterialId:"carbide",coatingId:"altin",toolTypeId:"end_mill",materialId:"steel_1018",aggressiveness:0.6,machine:{hp:15,maxRpm:10000,minRpm:60,maxIpm:400}};
for (const op of ["2d_pocket","2d_contour_rough","slotting","3d_adaptive","2d_adaptive"]) {
  const b=calculate({...base,operationId:op,priority:"balanced"}), d=calculate({...base,operationId:op});
  ok(JSON.stringify([b.rpm,b.ipm,b.woc,b.doc])===JSON.stringify([d.rpm,d.ipm,d.woc,d.doc]),op+": default == balanced (legacy benchmark)");
  const f=calculate({...base,operationId:op,priority:"finish"}), s=calculate({...base,operationId:op,priority:"speed"});
  ok(f.mrr<=b.mrr+1e-6&&b.mrr<=s.mrr+1e-6,`${op}: MRR finish ${f.mrr} <= balanced ${b.mrr} <= speed ${s.mrr}`);
  ok(f.sfm===b.sfm,op+": finish priority does not slow surface speed");
}
// ball-nose finish scallop
const bn={...base,toolTypeId:"ball_end",operationId:"3d_parallel"};
const fb=calculate({...bn,priority:"finish"}), bb=calculate({...bn,priority:"balanced"});
ok(fb.woc<bb.woc,"finish ball-nose stepover < balanced ("+fb.woc+" vs "+bb.woc+")");
const R=0.25, h=(4/3)*32e-6, s=2*Math.sqrt(2*R*h-h*h);
ok(Math.abs(fb.woc-s)<5e-4,"stepover = scallop formula for 32 uin Ra ("+s.toFixed(4)+")");
const fb16=calculate({...bn,priority:"finish",targetRa:16});
ok(fb16.woc<fb.woc,"tighter Ra target -> smaller stepover");
ok(fb.finishPlan&&fb.finishPlan.scallop&&fb.finishPlan.scallop.raRealisticUin<=33,"predicted realistic Ra <= target");
// feed-mark cap
const fm=calculate({...base,operationId:"2d_contour_finish",priority:"finish",targetRa:8});
ok(fm.programmedFpt<=Math.sqrt(4*0.5*(4/3)*8e-6)+1e-4,"feed per tooth capped by fz^2/4D <= 4/3 Ra");
// flat finishing WOC in Harvey 3-5% band
const ff=calculate({...base,operationId:"2d_contour_finish",priority:"finish"});
ok(ff.woc<=0.5*0.05+1e-6,"finishing radial <= 5% D");
// roughing leaves Seco stock
const rr=calculate({...base,operationId:"2d_contour_rough"});
ok(rr.finishPlan&&Math.abs(rr.finishPlan.stockToLeaveRadial-0.0075)<1e-4,"Seco stock 1.5%D");
process.exit(fails?1:0);
