import { calculate } from "./cncEngine.js";
let fails=0; const ok=(c,m)=>{ if(!c){console.log("FAIL:",m); fails++;} else console.log("ok:",m); };
const base={diameter:0.5,flutes:3,loc:1,toolMaterialId:"carbide",coatingId:"altin",toolTypeId:"end_mill",materialId:"alum_6061",aggressiveness:0.6,machine:{hp:10,maxRpm:12000,minRpm:60,maxIpm:400}};
// Shader7 worked example: 50 mm bore, 12 mm cutter -> factor 0.76; external 1.24
const mm=25.4;
let r=calculate({...base,diameter:12/mm,operationId:"2d_bore_finish",featureDiameter:50/mm});
ok(Math.abs(r.circular.centerlineFactor-0.76)<0.001,"internal factor (50-12)/50 = 0.76");
ok(Math.abs(r.circular.centerlineIpm - r.ipm*0.76)<0.2,"centerline IPM = edge IPM x 0.76");
r=calculate({...base,diameter:12/mm,operationId:"2d_circular_boss_finish",featureDiameter:50/mm});
ok(Math.abs(r.circular.centerlineFactor-1.24)<0.001,"external factor (50+12)/50 = 1.24");
// too small bore
r=calculate({...base,operationId:"2d_bore_rough",featureDiameter:0.52});
ok(r.warnings.some(w=>/cannot orbit/.test(w)),"bore <1.05x tool warns");
r=calculate({...base,operationId:"2d_circular_pocket",featureDiameter:0.58});
ok(r.warnings.some(w=>/below 1\.2x/.test(w)),"bore <1.2x tool warns evacuation");
// solid core slug
r=calculate({...base,operationId:"2d_bore_rough",featureDiameter:1.5});
ok(r.warnings.some(w=>/core slug/.test(w)),"solid bore >2x tool warns core slug");
r=calculate({...base,operationId:"2d_bore_rough",featureDiameter:0.9});
ok(!r.warnings.some(w=>/core slug/.test(w)),"bore <=2x tool leaves no core");
// solid-start uses slot derate (slower than pilot version)
const solid=calculate({...base,operationId:"2d_bore_rough",featureDiameter:1.5});
const pilot=calculate({...base,operationId:"2d_bore_rough",featureDiameter:1.5,pilotDiameter:0.75});
ok(solid.sfm<pilot.sfm,"solid helical bore runs slower SFM than ring-clearing with pilot");
ok(solid.woc>=base.diameter*0.99,"solid bore WOC = full tool diameter");
ok(pilot.woc<base.diameter*0.6,"piloted bore WOC is a light ring engagement");
// ramp angle <= 3 deg
r=calculate({...base,operationId:"2d_circular_pocket",featureDiameter:0.75});
ok(r.circular.rampAngleDeg>=3 && r.circular.rampAngleDeg<=10.05,"helix ramp inside Harvey non-ferrous 3-10 deg band for aluminum");
// finish ops mark finishing, and finishing stock leave on roughing
r=calculate({...base,operationId:"2d_bore_rough",featureDiameter:1,pilotDiameter:0.6});
ok(r.finishPlan&&r.finishPlan.stockToLeaveRadial>=0.0075-1e-9&&r.finishPlan.stockToLeaveRadial<=0.0076,"1/2in tool leaves 1.5% D = 0.0075in");
// legacy bore still resolves
r=calculate({...base,operationId:"bore"}); ok(r.rpm>0,"legacy bore resolves");
process.exit(fails?1:0);
