import React from "react";

// Hand-drawn schematic tool illustrations (inline SVG, no external images, so
// they work offline, scale to any size and follow light/dark theme).
// Milling / drilling / tapping tools are drawn side-on with the cutting end at
// the bottom; turning inserts are drawn from above; boring bars side-on; turning
// operations as a small lathe schematic (workpiece + tool).
//   steel  = shank / body (theme foreground, light fill)
//   brand  = the cutting portion (theme brand green)

const SH = { fill: "currentColor", fillOpacity: 0.14, stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" };
const CT = { fill: "hsl(var(--brand))", fillOpacity: 0.28, stroke: "hsl(var(--brand))", strokeWidth: 1.8, strokeLinejoin: "round", strokeLinecap: "round" };
const LN = { fill: "none", stroke: "hsl(var(--brand))", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
const TH = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", strokeOpacity: 0.7 };
const WP = { fill: "currentColor", fillOpacity: 0.1, stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" };
const ARW = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round", strokeOpacity: 0.65, strokeDasharray: "2.5 2.5" };

const Shank = ({ y2 = 25, x = 26, w = 12 }) => <rect x={x} y="4" width={w} height={y2 - 4} rx="1.2" {...SH} />;
const Flutes = ({ x1 = 24, x2 = 40, y1 = 28, y2 = 54, n = 3 }) => (
  <g {...LN}>
    {Array.from({ length: n }).map((_, i) => {
      const t = i / n;
      const yy = y1 + (y2 - y1) * t;
      return <path key={i} d={`M${x1} ${yy + 10} L${x2} ${yy - 2}`} />;
    })}
  </g>
);

// ---------- milling / hole-making tool types ----------
const MILLING = {
  end_mill: () => (
    <>
      <Shank />
      <path d="M24 25 H40 V58 H24 Z" {...CT} />
      <Flutes y1={30} y2={52} n={3} />
      <path d="M24 58 H40" {...LN} />
    </>
  ),
  ball_end: () => (
    <>
      <Shank />
      <path d="M24 25 H40 V50 A8 8 0 0 1 24 50 Z" {...CT} />
      <g {...LN}><path d="M24 30 L40 22" opacity="0" /><path d="M24 40 L40 32" /><path d="M24 48 L40 40" /><path d="M26 56 L38 47" /></g>
    </>
  ),
  bull_nose: () => (
    <>
      <Shank />
      <path d="M24 25 H40 V54 Q40 58 36 58 H28 Q24 58 24 54 Z" {...CT} />
      <Flutes y1={30} y2={52} n={3} />
    </>
  ),
  corner_round: () => (
    <>
      {/* shank + neck */}
      <path d="M26 4 H38 V20 L42 25 H22 L26 20 Z" {...SH} />
      {/* head: straight flutes above, concave quarter-round cutting form at the end, small pilot nose */}
      <path d="M22 25 H42 V44 A8 8 0 0 0 34 52 V58 H30 V52 A8 8 0 0 0 22 44 Z" {...CT} />
      {/* helical flutes */}
      <g {...LN}>
        <path d="M22 30 L42 25" />
        <path d="M22 37 L42 32" />
        <path d="M22 44 L38 38.5" />
      </g>
      {/* highlight */}
      <path d="M25 27 V42" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M29 6 V19" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  concave_radius: () => (
    <>
      <path d="M26 4 H38 V20 L42 25 H22 L26 20 Z" {...SH} />
      {/* head with large full-radius corners and a small flat in the middle */}
      <path d="M22 25 H42 V50 A8 8 0 0 1 34 58 H30 A8 8 0 0 1 22 50 Z" {...CT} />
      <g {...LN}>
        <path d="M22 31 L42 26" />
        <path d="M22 38 L42 33" />
        <path d="M22 45 L42 40" />
        <path d="M23 52 L38 47" />
      </g>
      <path d="M25 27 V44" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M29 6 V19" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  round_insert: () => (
    <>
      {/* arbor / shank with a flat */}
      <path d="M26 3 H38 V13 H26 Z" {...SH} />
      <path d="M29 3 V13" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
      {/* cutter body */}
      <path d="M26 13 H38 L46 20 V36 H18 V20 Z" {...SH} />
      <path d="M22 22 V34" stroke="#fff" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
      {/* coolant ports */}
      <circle cx="32" cy="28" r="1.6" fill="currentColor" fillOpacity=".35" />
      {/* two round inserts seated in pockets at the nose */}
      <path d="M14 36 H50 V40 H14 Z" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="20" cy="44" r="8.5" {...CT} />
      <circle cx="44" cy="44" r="8.5" {...CT} />
      <circle cx="20" cy="44" r="5.4" fill="none" stroke="hsl(var(--brand))" strokeOpacity=".7" strokeWidth="1" />
      <circle cx="44" cy="44" r="5.4" fill="none" stroke="hsl(var(--brand))" strokeOpacity=".7" strokeWidth="1" />
      {/* clamp screws (torx head) */}
      {[20, 44].map((x) => (
        <g key={x}>
          <circle cx={x} cy="44" r="2.6" fill="currentColor" fillOpacity=".55" stroke="currentColor" strokeWidth="1" />
          <path d={`M${x - 1.4} 44 H${x + 1.4} M${x} 42.6 V45.4`} stroke="#fff" strokeOpacity=".8" strokeWidth=".8" />
        </g>
      ))}
    </>
  ),
  roughing: () => (
    <>
      <Shank />
      <path d="M24 25 L27 28 L24 31 L27 34 L24 37 L27 40 L24 43 L27 46 L24 49 L27 52 L24 55 V58 H40 V55 L37 52 L40 49 L37 46 L40 43 L37 40 L40 37 L37 34 L40 31 L37 28 L40 25 Z" {...CT} />
      <g {...LN}><path d="M27 58 L37 25" opacity=".0"/><path d="M26 54 L38 44" /><path d="M26 44 L38 34" /></g>
    </>
  ),
  chamfer: () => (
    <>
      <Shank y2="25" />
      <path d="M22 25 H42 L42 33 L36 58 H28 L22 33 Z" {...CT} />
      <g {...LN}><path d="M22 33 L36 46" /><path d="M28 36 L38 44" opacity=".0"/><path d="M26 44 L34 52" /></g>
    </>
  ),
  face_mill: () => (
    <>
      {/* arbor with drive keyways */}
      <path d="M24 3 H40 V11 H24 Z" {...SH} />
      <path d="M20 11 H44 V17 H20 Z" {...SH} />
      <rect x="22.5" y="12.2" width="4" height="3.6" fill="currentColor" fillOpacity=".4" />
      <rect x="37.5" y="12.2" width="4" height="3.6" fill="currentColor" fillOpacity=".4" />
      {/* tapered cutter body */}
      <path d="M12 17 H52 L58 36 H6 Z" {...SH} />
      <path d="M12 22 L10 32" stroke="#fff" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" />
      {/* bore + coolant holes */}
      <circle cx="32" cy="26" r="3" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="26" r="1.2" fill="currentColor" fillOpacity=".4" />
      <circle cx="44" cy="26" r="1.2" fill="currentColor" fillOpacity=".4" />
      {/* insert pockets around the rim with indexable inserts + clamp screws */}
      {[10, 22, 34, 46, 58].map((x, i) => (
        <g key={x} transform={`translate(${x - 8} 0)`}>
          {i < 4 && (
            <g>
              <path d="M2 34 H14 L13 46 H1 Z" {...CT} transform="rotate(-6 8 40)" />
              <circle cx="7.5" cy="40" r="2.2" fill="currentColor" fillOpacity=".5" stroke="currentColor" strokeWidth=".9" transform="rotate(-6 8 40)" />
            </g>
          )}
        </g>
      ))}
      {/* a wiper-flat line to show the cutting plane */}
      <path d="M4 50 H60" stroke="currentColor" strokeOpacity=".5" strokeWidth="1" strokeDasharray="2 2" />
    </>
  ),
  drill: () => (
    <>
      <Shank y2="24" />
      <path d="M25 24 H39 V47 L32 58 L25 47 Z" {...CT} />
      <g {...LN}><path d="M25 28 C31 28 33 32 39 32" /><path d="M25 36 C31 36 33 40 39 40" /><path d="M26 45 C30 45 31 48 34 51" /></g>
    </>
  ),
  tap: () => (
    <>
      <rect x="29" y="3" width="6" height="9" rx="1" {...SH} />
      <rect x="25" y="12" width="14" height="12" rx="1.2" {...SH} />
      <path d="M24 24 H40 V54 L36 58 H28 L24 54 Z" {...CT} />
      <g {...TH}>{[28, 33, 38, 43, 48, 53].map((y) => <path key={y} d={`M24 ${y} L40 ${y - 2.5}`} />)}</g>
      <g {...LN}><path d="M32 24 V56" opacity=".0"/></g>
    </>
  ),
  slitting_saw: () => (
    <>
      <circle cx="32" cy="32" r="25" {...CT} />
      <circle cx="32" cy="32" r="25" fill="none" stroke="hsl(var(--brand))" strokeWidth="4" strokeDasharray="2.2 2.2" strokeOpacity=".9" />
      <circle cx="32" cy="32" r="17" fill="var(--card, #fff)" fillOpacity=".55" stroke="currentColor" strokeWidth="1.2" strokeOpacity=".5" />
      <circle cx="32" cy="32" r="5" {...SH} />
    </>
  ),
  t_slot: () => (
    <>
      <Shank x="28" w="8" y2="38" />
      <path d="M16 38 H48 V52 H16 Z" {...CT} />
      <g {...LN}>{[19, 25, 31, 37, 43].map((x) => <path key={x} d={`M${x} 52 L${x + 3} 38`} />)}</g>
    </>
  ),
};

// ---------- tap styles ----------
const TAP_BODY = <path d="M24 22 H40 V54 L36 58 H28 L24 54 Z" {...CT} />;
const TAP_HEAD = (
  <>
    <rect x="29" y="3" width="6" height="8" rx="1" {...SH} />
    <rect x="25" y="11" width="14" height="11" rx="1.2" {...SH} />
  </>
);
const TAP_STYLE = {
  spiral_point: () => (
    <>{TAP_HEAD}{TAP_BODY}
      <g {...TH}>{[27, 32, 37, 42].map((y) => <path key={y} d={`M24 ${y} L40 ${y - 2.5}`} />)}</g>
      <g {...LN}><path d="M26 56 L31 46 L35 56" /><path d="M32 22 V44" opacity=".7" /></g>
    </>
  ),
  spiral_flute: () => (
    <>{TAP_HEAD}{TAP_BODY}
      <g {...TH}>{[27, 32, 37, 42, 47, 52].map((y) => <path key={y} d={`M24 ${y} L40 ${y - 2.5}`} />)}</g>
      <g {...LN}><path d="M25 52 C31 46 31 36 39 30" /><path d="M30 57 C34 50 36 42 40 36" opacity=".8" /></g>
    </>
  ),
  straight_flute: () => (
    <>{TAP_HEAD}{TAP_BODY}
      <g {...TH}>{[27, 32, 37, 42, 47, 52].map((y) => <path key={y} d={`M24 ${y} L40 ${y - 2.5}`} />)}</g>
      <g {...LN}><path d="M29 24 V56" /><path d="M35 24 V56" /></g>
    </>
  ),
  forming: () => (
    <>{TAP_HEAD}
      <path d="M24 22 L26 25 L24 28 L26 31 L24 34 L26 37 L24 40 L26 43 L24 46 L26 49 L24 52 L28 58 H36 L40 52 L38 49 L40 46 L38 43 L40 40 L38 37 L40 34 L38 31 L40 28 L38 25 L40 22 Z" {...CT} />
      <g {...TH}>{[28, 34, 40, 46].map((y) => <path key={y} d={`M26 ${y} L38 ${y - 2.5}`} />)}</g>
    </>
  ),
};

// ---------- turning insert shapes (top view, nose corner at bottom) ----------
const diamond = (ang, a = 24) => {
  const b = a * Math.tan((ang / 2) * Math.PI / 180);
  return `M32 ${32 + a} L${32 + b} 32 L32 ${32 - a} L${32 - b} 32 Z`;
};
const poly = (cx, cy, radii, start = 90) =>
  radii.map((r, i) => {
    const th = ((start + (360 / radii.length) * i) * Math.PI) / 180;
    return `${i ? "L" : "M"}${(cx + r * Math.cos(th)).toFixed(1)} ${(cy + r * Math.sin(th)).toFixed(1)}`;
  }).join(" ") + " Z";
const INSERT_NOSE = (x, y) => <circle cx={x} cy={y} r="2.6" fill="hsl(var(--brand))" />;
const INSERT = {
  C: () => (<><path d={diamond(80, 22)} {...CT} /><circle cx="32" cy="32" r="3.2" {...SH} />{INSERT_NOSE(32, 52)}</>),
  D: () => (<><path d={diamond(55, 25)} {...CT} /><circle cx="32" cy="32" r="3.2" {...SH} />{INSERT_NOSE(32, 55)}</>),
  V: () => (<><path d={diamond(35, 27)} {...CT} /><circle cx="32" cy="32" r="3" {...SH} />{INSERT_NOSE(32, 57)}</>),
  T: () => (<><path d={poly(32, 34, [24, 24, 24], 90)} {...CT} /><circle cx="32" cy="34" r="3.2" {...SH} />{INSERT_NOSE(32, 54)}</>),
  W: () => (<><path d={poly(32, 32, [24, 17, 24, 17, 24, 17], 90)} {...CT} /><circle cx="32" cy="32" r="3.2" {...SH} />{INSERT_NOSE(32, 53)}</>),
  S: () => (<><rect x="14" y="14" width="36" height="36" rx="2" transform="rotate(45 32 32)" {...CT} /><circle cx="32" cy="32" r="3.2" {...SH} />{INSERT_NOSE(32, 54)}</>),
  R: () => (<><circle cx="32" cy="32" r="22" {...CT} /><circle cx="32" cy="32" r="3.2" {...SH} />{INSERT_NOSE(32, 54)}</>),
};

// ---------- boring bars (side view, tip to the right) ----------
const BAR = (fill, damped) => () => (
  <>
    <rect x="4" y="22" width="14" height="22" rx="2" {...SH} />
    <rect x="18" y="26" width="34" height="14" rx="1.5" {...(fill === "carbide" ? { ...SH, fillOpacity: 0.3 } : SH)} />
    {damped && <rect x="26" y="29.5" width="18" height="7" rx="3" fill="hsl(var(--brand))" fillOpacity=".35" stroke="hsl(var(--brand))" strokeWidth="1.2" />}
    <path d="M52 26 L60 28 L58 36 L52 40 Z" {...CT} />
  </>
);
const BARS = {
  steel: BAR("steel", false),
  carbide: BAR("carbide", false),
  damped_steel: BAR("steel", true),
  damped_carbide: BAR("carbide", true),
};

// ---------- turning operations (lathe schematic: chuck left, tool right/top) ----------
const Chuck = () => <rect x="3" y="18" width="9" height="28" rx="1.5" {...SH} />;
const TURN_OP = {
  od: () => (<><Chuck /><rect x="12" y="22" width="36" height="20" {...WP} /><path d="M26 8 L34 8 L34 14 L30 20 L26 20 Z" {...CT} /><path d="M40 14 H18" {...ARW} /></>),
  face: () => (<><Chuck /><rect x="12" y="20" width="30" height="24" {...WP} /><path d="M46 10 L52 10 L52 24 L48 24 L44 14 Z" {...CT} transform="translate(0,0)" /><path d="M54 36 V18" {...ARW} /></>),
  id: () => (<><Chuck /><path d="M12 16 H54 V48 H12 Z" {...WP} /><rect x="12" y="28" width="42" height="8" fill="var(--card, #fff)" fillOpacity=".9" stroke="currentColor" strokeWidth="1" strokeOpacity=".4" /><path d="M58 31 H34 L32 34 L36 36 H58 Z" {...CT} /><path d="M30 24 H16" {...ARW} /></>),
  drill: () => (<><Chuck /><rect x="12" y="16" width="40" height="32" {...WP} /><path d="M60 28 H42 L32 32 L42 36 H60 Z" {...CT} /><path d="M26 32 H16" {...ARW} /></>),
  groove: () => (<><Chuck /><rect x="12" y="22" width="40" height="20" {...WP} /><rect x="29" y="22" width="6" height="7" fill="var(--card, #fff)" stroke="none" /><path d="M29 6 H35 V24 H29 Z" {...CT} /></>),
  parting: () => (<><Chuck /><rect x="12" y="20" width="36" height="24" {...WP} /><rect x="30" y="20" width="3" height="14" fill="var(--card, #fff)" stroke="none" /><path d="M29.5 4 H33.5 V34 H29.5 Z" {...CT} /></>),
  thread: () => (<><Chuck /><path d="M12 22 H20 L22 20 L24 22 L26 20 L28 22 L30 20 L32 22 L34 20 L36 22 L38 20 L40 22 L48 22 V42 H12 Z" {...WP} /><path d="M22 6 L30 6 L30 14 L26 19 L22 14 Z" {...CT} /></>),
};

const SETS = { tool: MILLING, tap: TAP_STYLE, insert: INSERT, bar: BARS, turnop: TURN_OP };
const VIEW = { tool: "0 0 64 64", tap: "0 0 64 64", insert: "0 0 64 64", bar: "0 0 64 64", turnop: "0 0 64 64" };

/**
 * kind: "tool" (milling/hole tool type) | "tap" (tap style) | "insert" (turning
 * insert shape id C/D/V/T/W/S/R) | "bar" (boring bar id) | "turnop" (turning
 * operation kind: od/face/id/drill/groove/parting/thread)
 */
export default function ToolIcon({ kind = "tool", id, className = "w-8 h-8", title }) {
  const Draw = SETS[kind] && SETS[kind][id];
  if (!Draw) return <span className={className} aria-hidden="true" />;
  return (
    <svg viewBox={VIEW[kind]} className={`${className} shrink-0 text-foreground/80`} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} xmlns="http://www.w3.org/2000/svg">
      <Draw />
    </svg>
  );
}

export const TOOL_ICON_IDS = Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, Object.keys(v)]));
