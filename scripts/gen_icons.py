"""Generate the PrecisionPath CNC app icon (master SVG -> PNG at all required
sizes) for PWA manifest, iOS, and Android via Capacitor's asset pipeline.
"""
import subprocess
import os

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <!-- End mill flutes -->
  <g transform="translate(256,220)">
    <rect x="-34" y="-140" width="68" height="180" rx="14" fill="#cbd5e1"/>
    <path d="M -34 40 L 34 40 L 22 118 Q 0 150 -22 118 Z" fill="url(#accent)"/>
    <line x1="-18" y1="-120" x2="-18" y2="20" stroke="#64748b" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
    <line x1="0" y1="-120" x2="0" y2="20" stroke="#64748b" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
    <line x1="18" y1="-120" x2="18" y2="20" stroke="#64748b" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
  </g>
  <!-- toolpath arc -->
  <path d="M 96 388 Q 256 460 416 388" stroke="url(#accent)" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.9"/>
  <circle cx="96" cy="388" r="10" fill="#22d3ee"/>
  <circle cx="416" cy="388" r="10" fill="#22d3ee"/>
</svg>"""

MASTER_SVG_PATH = "/home/user/workspace/precisionpath-cnc/scripts/master_icon.svg"
with open(MASTER_SVG_PATH, "w") as f:
    f.write(SVG)

# Sizes needed:
# PWA manifest: 192, 512 (any + maskable)
# Apple touch icon: 180
# iOS app icon set (via Capacitor @capacitor/assets, but we still bake a 1024 source)
# Android adaptive icon foreground/legacy source: 1024
SIZES = [48, 72, 96, 120, 128, 144, 152, 167, 180, 192, 256, 384, 512, 1024]

OUT_DIR = "/home/user/workspace/precisionpath-cnc/public/icons"
os.makedirs(OUT_DIR, exist_ok=True)

# Render via resvg/rsvg if present, else fall back to cairosvg, else Pillow-only
# rasterization is not possible for SVG, so try common CLI renderers first.
rendered = False
for tool, args in [
    ("rsvg-convert", None),
    ("inkscape", None),
]:
    if subprocess.run(["which", tool], capture_output=True).returncode == 0:
        for size in SIZES:
            out = f"{OUT_DIR}/icon-{size}.png"
            if tool == "rsvg-convert":
                subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), MASTER_SVG_PATH, "-o", out], check=True)
            else:
                subprocess.run(["inkscape", MASTER_SVG_PATH, f"--export-width={size}", f"--export-height={size}", f"--export-filename={out}"], check=True)
        rendered = True
        break

if not rendered:
    try:
        import cairosvg
        for size in SIZES:
            out = f"{OUT_DIR}/icon-{size}.png"
            cairosvg.svg2png(url=MASTER_SVG_PATH, write_to=out, output_width=size, output_height=size)
        rendered = True
    except ImportError:
        pass

print("rendered_via_vector_tool:", rendered)
