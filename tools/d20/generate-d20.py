"""Generate the Crawling Clock's d20 as a real, rotatable icosahedron.

The die used to be one flat drawing of an icosahedron seen face-on, with the counter
painted on top of its centre facet. That could not turn. This builds the solid itself:
twenty triangular faces, each a CSS 3D plane carrying its own inked artwork and its own
number, so the die rotates to bring a face to the front and the number arrives with it.

Two files come out, and the split is the point:

  module/src/crawling-clock-d20.js     the artwork and the value/face tables
  module/styles/crawling-clock-d20.css the geometry: every transform, every light level

Geometry is CSS, not JavaScript. CLAUDE.md forbids inline styles in the JS, and this is
why the rule pays: the widget rotates the die by swapping one class, and the browser
slerps between the two orientations on its own. No transform is ever computed at runtime.

    uv run --with numpy python tools/d20/generate-d20.py

The seed is fixed, so the output is stable; change it for a different hand.

---

Coordinates are CSS's throughout: x right, **y down**, z towards the viewer. Every vector
here can go straight into a matrix3d() without a flip. The vertex set is symmetric under
y -> -y, so reading the usual construction in this frame still gives a true icosahedron.

The size is not chosen, it is solved for. The counter's per-value fitting in
crawling-clock.css was measured against the flat die's centre facet, and that table is
worth keeping: it is the one part of this that had to be done by eye. So the solid is
scaled until its front face, *after* perspective magnifies it, projects to exactly the
facet those numbers were fitted to. The table then transfers untouched. See SOLVE below.
"""

import numpy as np, random
from pathlib import Path

random.seed(11)

REPO = Path(__file__).resolve().parents[2]
JS_OUT = REPO / "module/src/crawling-clock-d20.js"
CSS_OUT = REPO / "module/styles/crawling-clock-d20.css"

# Where the light comes from: over the viewer's left shoulder. Negative y is up.
# The same direction the flat die was lit from, so the ink reads the way it used to.
LIGHT = np.array([-0.4, -0.72, 0.57]); LIGHT /= np.linalg.norm(LIGHT)

# The flat die's centre facet, in the die's own 100-unit box. Its base measured 49.3
# units across, which for an equilateral triangle fixes the circumradius the front face
# has to project to. Everything below is scaled to hit this number.
TARGET_FACE_R = 49.3 / 3 ** 0.5

# Perspective distance, as a multiple of the die's width. Shallow enough that the far
# facets do not smear, deep enough that the solid reads as a solid.
PERSPECTIVE = 5.0

# The counter's box sat at 55 units in the flat die while the facet's centroid was at
# 50.03, so the numbers were fitted 4.97 units below centre. Reproduce that offset or
# every value in the fitting table is wrong by the same amount.
FIGURE_DROP = 55.0 - (21.5 + 64.3 + 64.3) / 3

# Ink weights from crawling-clock.css, in the flat die's units. Faces are drawn in those
# same units, so they carry over directly.
HATCH_WIDTH, EDGE_WIDTH = 0.5, 1.4

# --- The solid ------------------------------------------------------------------

phi = (1 + 5 ** 0.5) / 2
V = []
for s1 in (1, -1):
    for s2 in (1, -1):
        V += [(0, s1, s2 * phi), (s1, s2 * phi, 0), (s1 * phi, 0, s2)]
V = np.array(sorted(set(V)), dtype=float)
V /= np.linalg.norm(V[0])                                   # circumradius 1

edge = min(np.linalg.norm(V[i] - V[j]) for i in range(12) for j in range(12) if i != j)
faces = [(i, j, k) for i in range(12) for j in range(i + 1, 12) for k in range(j + 1, 12)
         if all(abs(np.linalg.norm(V[a] - V[b]) - edge) < 1e-6
                for a, b in ((i, j), (j, k), (i, k)))]
assert len(faces) == 20, len(faces)

# The solid is convex and centred on the origin, so a face's centroid *is* its outward
# normal, and the distance to it is the inradius. Both are the same for every face.
inradius = float(np.linalg.norm(V[list(faces[0])].mean(axis=0)))
face_r = float(np.linalg.norm(V[faces[0][0]] - V[list(faces[0])].mean(axis=0)))

# SOLVE. A face sits at z = S*inradius, so perspective magnifies it by P/(P - S*inradius)
# where P is the perspective distance. Ask for the magnified front face to land on
# TARGET_FACE_R and solve for the scale S:
#
#   S*face_r * P / (P - S*inradius) = TARGET_FACE_R
#
P = PERSPECTIVE * 100
S = TARGET_FACE_R * P / (face_r * P + TARGET_FACE_R * inradius)
V *= S

inradius *= S
face_r *= S
magnify = P / (P - inradius)
assert abs(face_r * magnify - TARGET_FACE_R) < 1e-9

# One wobble per vertex in 3D, so every face and every edge that meets there meets there
# on all of them. Wobbling in each face's own plane instead would tear the solid open
# along its creases.
Vw = V + np.array([[random.uniform(-.5, .5) for _ in range(3)] for _ in range(12)])

# A bow per shared edge, again in 3D. Each face projects it into its own plane, so the
# two drawings of one crease bow together rather than crossing.
bows = {}
for f in faces:
    for a, b in ((f[0], f[1]), (f[1], f[2]), (f[0], f[2])):
        bows.setdefault((min(a, b), max(a, b)), random.uniform(-.6, .6))

# --- Numbering ------------------------------------------------------------------
#
# What makes a d20 read as a d20 rather than as twenty numbered triangles is that
# opposite faces sum to 21. The faces come in antipodal pairs, so that property is
# free; which pair gets which number is shuffled, because running 1..10 around the
# solid in generation order puts sequences on neighbouring faces and looks printed.

pairs, taken = [], set()
for i, f in enumerate(faces):
    if i in taken:
        continue
    c = V[list(f)].mean(axis=0)
    j = next(k for k, g in enumerate(faces)
             if np.allclose(V[list(g)].mean(axis=0), -c, atol=1e-9))
    pairs.append((i, j)); taken |= {i, j}
assert len(pairs) == 10

lows = list(range(1, 11)); random.shuffle(lows)
value_of_face = {}
for (i, j), low in zip(pairs, lows):
    if random.random() < .5:
        i, j = j, i
    value_of_face[i] = low
    value_of_face[j] = 21 - low
face_of_value = {v: f for f, v in value_of_face.items()}
assert sorted(value_of_face.values()) == list(range(1, 21))

# --- Each face's frame ----------------------------------------------------------
#
# A face is a plane element in CSS, so it needs a local frame: x across, y *down* the
# face, z out of it. Build it from the outward normal and the vertex chosen as the
# numeral's apex, then read the frame off as the columns of a matrix3d.
#
# A is derived as B x C rather than picked, which forces det[A B C] = +1. A frame that
# came out left-handed would render every face mirrored -- and the numbers with it.

frames, normals = [], []
for f in faces:
    c = V[list(f)].mean(axis=0)
    n = c / np.linalg.norm(c)
    up = V[f[0]] - c
    up -= n * up.dot(n)
    up /= np.linalg.norm(up)
    B = -up                                      # local +y: down the face
    C = n                                        # local +z: out of the face
    A = np.cross(B, C)                           # local +x: across it
    R = np.column_stack([A, B, C])
    assert np.linalg.det(R) > 0.999, np.linalg.det(R)
    frames.append(R); normals.append(n)


def m3(M):
    """A 3x3 rotation as CSS matrix3d(), which is column-major."""
    cols = [f"{M[r, c]:.6f}" for c in range(3) for r in range(3)]
    return ("matrix3d(" + ", ".join(cols[0:3]) + ", 0, " + ", ".join(cols[3:6]) +
            ", 0, " + ", ".join(cols[6:9]) + ", 0, 0, 0, 0, 1)")


# --- Artwork --------------------------------------------------------------------
#
# Drawn in each face's own plane, in the flat die's units, so the ink weights and the
# hatch spacing carry over from the old drawing without rescaling. The element's box is
# the triangle's bounding box: width edge, height 1.5 * circumradius, apex at the top.

W, H = face_r * 3 ** 0.5, face_r * 1.5


def to_local(p, R, c):
    """A 3D point in the face's plane, as (x, y) in its element box."""
    d = p - c
    return float(d.dot(R[:, 0])) + W / 2, float(d.dot(R[:, 1])) + face_r


def inside(poly, x, y, margin=.07):
    (x1, y1), (x2, y2), (x3, y3) = poly
    d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d
    b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d
    return a >= margin and b >= margin and (1 - a - b) >= margin


def hatch(poly, angle, step=2.0):
    """Pen strokes across a triangle, clipped to it and jittered off true."""
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    cx, cy = sum(xs) / 3, sum(ys) / 3
    ca, sa = np.cos(angle), np.sin(angle)
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    lines, seg, t = [], [], -span
    while t <= span:
        seg = []
        for u in np.linspace(-span, span, 48):
            x, y = cx + ca * u - sa * t, cy + sa * u + ca * t
            if inside(poly, x, y):
                seg.append((x + random.uniform(-.18, .18), y + random.uniform(-.18, .18)))
            else:
                if len(seg) > 2:
                    lines.append(seg)
                seg = []
        if len(seg) > 2:
            lines.append(seg)
        t += step * random.uniform(.82, 1.18)
    return lines


def art(idx):
    """One face's SVG: hatching, then its three inked edges."""
    f, R = faces[idx], frames[idx]
    c = V[list(f)].mean(axis=0)
    poly = [to_local(Vw[i], R, c) for i in f]

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" '
           f'class="cc-d20-3d__art" preserveAspectRatio="none" aria-hidden="true">',
           f'<polygon class="cc-d20-3d__plate" points="'
           + ' '.join(f'{x:.2f},{y:.2f}' for x, y in poly) + '"/>',
           '<g class="cc-d20-3d__hatch">']
    for seg in hatch(poly, random.uniform(0, np.pi)):
        out.append('<path d="M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in seg) + '"/>')
    out.append('</g><g class="cc-d20-3d__edges">')

    # Every face draws all three of its own edges. A crease between two visible faces is
    # therefore inked twice, from slightly different projections of the same bow, which
    # is what a second pen pass looks like -- and it means a silhouette edge whose other
    # face is culled never goes missing.
    for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
        (x1, y1), (x2, y2) = to_local(Vw[a], R, c), to_local(Vw[b], R, c)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        dx, dy = x2 - x1, y2 - y1
        L = (dx * dx + dy * dy) ** .5
        o = bows[(min(a, b), max(a, b))]
        out.append(f'<path d="M{x1:.2f},{y1:.2f} '
                   f'Q{mx - dy / L * o:.2f},{my + dx / L * o:.2f} {x2:.2f},{y2:.2f}"/>')
    out.append('</g></svg>')
    return ''.join(out)


# --- Lighting -------------------------------------------------------------------
#
# The ink is drawn on the die, so it turns with it. The *light* does not: it stays over
# the viewer's shoulder while the solid rotates underneath. So a face's shade depends on
# which face is currently forward, and the whole 20x20 table is precomputed here.
#
# It ends up in CSS as `.--to<value> .--f<face> { --cc-face-lit: n }`, which means the
# light sweeps across the die during a rotation for free: the custom property is on a
# transition alongside the transform, so the browser interpolates it.

LEVELS = 5


def lit(value, face):
    """0..1, quantised, for `face` while the die shows `value`."""
    world = frames[face_of_value[value]].T @ normals[face]
    return round(max(0.0, float(world.dot(LIGHT))) * LEVELS) / LEVELS


# --- Emit -----------------------------------------------------------------------

banner = ("Generated by tools/d20/generate-d20.py -- do not edit by hand.\n"
          "\n"
          "A real icosahedron: twenty faces, each carrying its own pen hatching and its\n"
          "own number, so the die turns to bring a value to the front. Opposite faces\n"
          "sum to 21, as on a real d20.\n")

js = [f"// {l}" if l else "//" for l in banner.split("\n")]
js += [
    "",
    "// Face artwork, indexed by face. Classes only -- every colour, weight and",
    "// transform lives in the stylesheet.",
    "export const CRAWLING_CLOCK_D20_ART = [",
]
js += [f'    `{art(i)}`,' for i in range(20)]
js += [
    "];",
    "",
    "// The number inked on each face, indexed by face.",
    "export const CRAWLING_CLOCK_D20_VALUES = ["
    + ", ".join(str(value_of_face[i]) for i in range(20)) + "];",
    "",
    "// The clock runs 20 down to 1 and every one of those is a real face, so the die",
    "// never has to lie about what it reads.",
    "export const CRAWLING_CLOCK_D20_MIN = 1;",
    "export const CRAWLING_CLOCK_D20_MAX = 20;",
    "",
]
JS_OUT.write_text("\n".join(js))

css = [f"/* {banner.rstrip()} */", "",
       "/* Metrics, all solved for in the generator. Sizes are fractions of the die's",
       "   width, so the whole die follows --cc-die-size. */",
       ".cc-d20-3d {",
       f"    --cc-d20-perspective: calc(var(--cc-die-size) * {PERSPECTIVE:.4f});",
       f"    --cc-d20-inradius: calc(var(--cc-die-size) * {inradius / 100:.6f});",
       f"    --cc-d20-face-w: calc(var(--cc-die-size) * {W / 100:.6f});",
       f"    --cc-d20-face-h: calc(var(--cc-die-size) * {H / 100:.6f});",
       "",
       "    /* The counter's fitting in crawling-clock.css was measured on the flat die,",
       "       after perspective. A face element is drawn before it, so the numeral is",
       "       scaled down by the magnification to come back out the same size. */",
       f"    --cc-d20-figure-scale: {1 / magnify:.6f};",
       f"    --cc-d20-figure-top: {(face_r + FIGURE_DROP / magnify) / H * 100:.4f}%;",
       "",
       f"    --cc-d20-hatch-width: {HATCH_WIDTH:.3f};",
       f"    --cc-d20-edge-width: {EDGE_WIDTH:.3f};",
       "}",
       "",
       "/* Where each face sits on the solid. matrix3d turns the element into the face's",
       "   plane; translateZ then walks it out to the surface along its own normal, which",
       "   is exactly the inradius. Static -- these never change. */"]
for i in range(20):
    css.append(f".cc-d20-3d__face--f{i} {{ transform: {m3(frames[i])} "
               "translateZ(var(--cc-d20-inradius)); }")

css += ["",
        "/* One orientation per value: the transpose of that face's own frame, which is",
        "   the rotation that brings it square to the viewer. Swapping between two of",
        "   these is the whole animation -- the browser decomposes both matrices and",
        "   slerps the rotation, so the die takes the short way round on its own. */"]
for v in range(1, 21):
    css.append(f".cc-d20-3d__body--to{v} {{ transform: {m3(frames[face_of_value[v]].T)}; }}")

css += ["",
        "/* How much light each face catches, per orientation. Generated: the light is",
        "   fixed in the room, so this is a 20x20 table, grouped by level. */"]
for v in range(1, 21):
    by_level = {}
    for face in range(20):
        by_level.setdefault(lit(v, face), []).append(face)
    for level in sorted(by_level, reverse=True):
        sel = ",\n".join(f".cc-d20-3d__body--to{v} .cc-d20-3d__face--f{f}"
                         for f in by_level[level])
        css.append(f"{sel} {{ --cc-face-lit: {level:.1f}; }}")

CSS_OUT.write_text("\n".join(css) + "\n")

print(f"scale {S:.3f}  inradius {inradius:.3f}  face r {face_r:.3f} "
      f"(x{magnify:.4f} = {face_r * magnify:.3f}, target {TARGET_FACE_R:.3f})")
print("face element", f"{W:.2f} x {H:.2f}", "units")
print("values by face:", [value_of_face[i] for i in range(20)])
print("wrote", JS_OUT.relative_to(REPO), f"({JS_OUT.stat().st_size // 1024} KB)")
print("wrote", CSS_OUT.relative_to(REPO), f"({CSS_OUT.stat().st_size // 1024} KB)")
