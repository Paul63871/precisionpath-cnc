import { calculateTurning, threadInfeeds } from "./turningEngine.js";
import { PART_MATERIALS } from "./cncData.js";
import { maxFeedForNose, partingWidthFor } from "./turningData.js";
let fails=0; const ok=(c,m)=>{ if(!c){console.log("FAIL:",m); fails++;} else console.log("ok:",m); };
const mach={hp:15,maxRpm:4000,minRpm:20,maxIpm:400,chuckMaxRpm:0};
const base={materialId:"steel_1018",gradeId:"coated",aggressiveness:0.6,workDiameter:2,finishDiameter:1.8,cutLength:3,insert:{shapeId:"C",ic:0.5,noseRadius:1/32},machine:mach,workholding:{stickout:4,gripDiameter:2,jawTypeId:"serrated",chuckGripForce:8000}};
let r=calculateTurning({...base,operationId:"od_rough"});
ok(Math.abs(r.rpm - 3.8197*r.sfm/2)<3,"RPM = 3.82 SFM / D");
ok(Math.abs(r.mrr-12*r.sfm*r.feedIpr*r.doc)<0.02,"MRR = 12 SFM f ap");
ok(Math.abs(r.cuttingForce - r.hpRequired*33000/r.sfm)<0.5,"Fc = HP x 33000 / SFM");
const nf=maxFeedForNose(1/32); ok(r.feedIpr<=nf.hi+1e-9,"rough feed <= Sandvik nose-radius max");
// finish feed limited by Ra = f^2/32r
let f=calculateTurning({...base,operationId:"od_finish",priority:"finish",targetRa:32});
ok(f.surface.raTheoreticalUin<=32/1.5+0.5,"finish theory Ra <= target/1.5 ("+f.surface.raTheoreticalUin+")");
const f63=calculateTurning({...base,operationId:"od_finish",priority:"finish",targetRa:63});
ok(f63.feedIpr>f.feedIpr,"looser Ra -> faster feed");
ok(f.sfm>=r.sfm,"finish SFM >= rough SFM (published rows)");
// priority
const fin=calculateTurning({...base,operationId:"od_rough",priority:"finish"}), spd=calculateTurning({...base,operationId:"od_rough",priority:"speed"});
ok(fin.mrr<=spd.mrr,"finish priority MRR <= speed priority MRR");
// materials
const m=(id,op="od_rough")=>calculateTurning({...base,materialId:id,operationId:op});
ok(m("alum_6061").sfm>m("steel_1018").sfm*1.5,"aluminum turns much faster than steel");
ok(m("titanium_gr5").sfm<m("steel_1018").sfm*0.3,"titanium much slower than steel");
ok(m("ss_17-4").sfm<m("ss_304").sfm,"17-4 slower than 304");
ok(m("cfrp").error&&m("g10").error,"composites excluded");
for (const mm of PART_MATERIALS.filter(x=>x.materialClass!=="composite"&&x.materialClass!=="wood")) { const q=m(mm.id); ok(!q.error&&q.rpm>0,"turns "+mm.id); }
// grades
ok(calculateTurning({...base,gradeId:"uncoated",operationId:"od_rough"}).sfm<r.sfm,"uncoated slower than coated on steel");
ok(calculateTurning({...base,materialId:"cast_iron",gradeId:"ceramic",operationId:"od_rough"}).sfm>calculateTurning({...base,materialId:"cast_iron",operationId:"od_rough"}).sfm*2,"ceramic >> coated on cast iron");
ok(calculateTurning({...base,materialId:"steel_1018",gradeId:"pcd"}).warnings.some(w=>/not normally used/.test(w)),"PCD on steel warns");
ok(calculateTurning({...base,materialId:"titanium_gr5",gradeId:"hss"}).warnings.some(w=>/not recommended/.test(w)),"HSS on titanium warns");
// threading: depth + schedule
const t=calculateTurning({...base,operationId:"thread_od",thread:{pitch:0.0625}});
ok(Math.abs(t.threadInfo.depth-0.61343*0.0625)<1e-4,"external thread depth 0.61343 P");
ok(Math.abs(t.feedIpr-0.0625)<1e-4,"thread feed = pitch");
const ti=t.threadInfo.schedule; ok(Math.abs(ti[ti.length-1].cumulative-t.threadInfo.depth)<2e-4,"schedule ends at full depth");
ok(ti.every((s,i)=>i===0||s.increment<=ti[i-1].increment+1e-9),"infeed decreasing (constant chip area)");
const ti2=threadInfeeds(0.04,6); ok(ti2[0].cumulative<ti2[1].cumulative,"cumulative increasing");
const ti3=calculateTurning({...base,operationId:"thread_id",thread:{pitch:0.0625}}).threadInfo; ok(Math.abs(ti3.depth-0.54127*0.0625)<1e-4,"internal depth 0.54127 P");
// parting
ok(Math.abs(partingWidthFor(0.3)-1/25.4)<1e-6&&Math.abs(partingWidthFor(1.2)-2/25.4)<1e-6,"Sandvik parting width table");
const p=calculateTurning({...base,operationId:"parting"}); ok(p.partInfo&&p.partInfo.nearCenterFeed<p.feedIpr,"near-centre feed reduced");
ok(p.sfm<r.sfm,"parting slower than turning");
// workholding
const long=calculateTurning({...base,operationId:"od_rough",workholding:{stickout:14,gripDiameter:2,jawTypeId:"smooth_steel",chuckGripForce:2000}});
ok(long.hold.severity==="high"&&long.warnings.some(w=>/6:1|10:1/.test(w)),"L/D 7 chuck only flagged");
ok(long.hold.deflection.estimateIn>calculateTurning({...base,operationId:"od_rough",workholding:{stickout:14,gripDiameter:2,tailstock:true}}).hold.deflection.estimateIn,"tailstock reduces deflection");
const weak=calculateTurning({...base,operationId:"od_rough",workholding:{stickout:3,gripDiameter:2,jawTypeId:"smooth_steel",chuckGripForce:100}});
ok(weak.hold.insufficient&&weak.warnings.some(w=>/Chuck grip/.test(w)),"insufficient grip flagged");
// boring
const b=calculateTurning({...base,operationId:"bore_rough",workDiameter:1.5,finishDiameter:1.6,bar:{id:"steel",diameter:0.5,overhang:3}});
ok(b.warnings.some(w=>/overhang is 6\.0x/.test(w)),"bar 6x > steel 4x limit warns");
const b2=calculateTurning({...base,operationId:"bore_rough",workDiameter:1.5,finishDiameter:1.6,bar:{id:"carbide",diameter:0.5,overhang:3}});
ok(!b2.warnings.some(w=>/overhang is/.test(w)),"carbide bar 6x OK");
// plastics
const ny=m("nylon66"); ok(ny.rpm>0&&ny.sfm<=800,"nylon within window");
ok(m("ptfe","od_finish").hold.deflection.estimateIn>m("steel_1018","od_finish").hold.deflection.estimateIn,"PTFE deflects more than steel");
// CSS
ok(r.css.g50>0&&r.css.useCss,"G50 provided"); ok(!t.css.useCss,"thread uses G97");
// drill
const d=calculateTurning({...base,operationId:"drill",drillDiameter:0.5,drillDepth:2}); ok(d.kind==="drill"&&d.drill.rpm>0,"lathe drilling");
process.exit(fails?1:0);
