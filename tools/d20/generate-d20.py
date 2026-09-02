"""Generate the Crawling Clock's d20 as a real, rotatable icosahedron, drawn by hand.

The die is the solid itself: twenty triangular faces placed as CSS 3D planes, each
carrying its own artwork and its own number, so a roll rotates the die and the value
arrives on the face that comes forward. The geometry is solved (see SOLVE below) and is
not the interesting part any more. The inking is.

The inking is a combination of three things, each of which was built and rendered on its
own before being merged, and each of which answers a different complaint about the first
version of this die:

  1. THE PAPER, which fixes "the vertices are very sharp". Every face owns two private
     feTurbulence fields. A low-frequency warp is fed to feDisplacementMap so the whole
     drawing sits on a sheet that is not flat, and a high-frequency tooth becomes an
     alpha mask so the ink skips the way graphite does. Corners stop being the meeting
     of two vectors and become a soft cluster of marks. See "The paper" below.

  2. THE VARIANCE, which fixes "the lines are all too regular per face". Hatch spacing is
     driven per face by `step = max(0.75, 3.2 - 2.4 * tone)`. That is the flat die's own
     formula, restored deliberately: an experiment that spread the twenty faces evenly
     across the full range looked mechanical in a different way, and the honest Lambert
     falloff reads better. Across the twenty faces the step runs about 0.9 to 3.2, so
     some facets are nearly solid tone and others are nearly bare.

     The light that drives it is fixed to the SOLID, not to the room. Shade cannot come
     from the viewing orientation, because the ink is drawn once and then turns with the
     die. The room's light is what --cc-face-lit does, separately, in the stylesheet.

  3. THE HAND, which keeps the facets from filling in. The pen is only down for a few
     units at a time; where it is up there is bare ground, and that bare ground is the
     grey. Nothing here fills a facet.

And the numeral gets its own clearing: the pen lifts more often where the number's ink
lands, so every face keeps a little bare plate under its figure the way the flat die's
bare centre facet did.

    uv run --with numpy python tools/d20/generate-d20.py

Two files come out, and the split is the point:

  module/src/crawling-clock-d20.js     the artwork and the value/face tables
  module/styles/crawling-clock-d20.css the geometry: transforms, lighting, per-face ink

Geometry is CSS, not JavaScript. CLAUDE.md forbids inline styles in the JS, and this is
why the rule pays: the widget rotates the die by swapping one class, and the browser
slerps between the two orientations on its own. No transform is ever computed at runtime.

The seed is fixed, so the output is stable; change it for a different hand.

---

Coordinates are CSS's throughout: x right, y down, z towards the viewer. Every vector
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
# same units, so they carry over directly. These are the die-wide defaults; each face
# then nudges its own weight by a few hundredths, because a pencil does not hold one
# point for twenty facets.
HATCH_WIDTH, EDGE_WIDTH = 0.5, 1.22

# --- The paper -------------------------------------------------------------------
#
# Every number below is in viewBox units, and one unit is 1.8 CSS pixels on a 180px die.
#
# WARP is the sheet buckling under the pen: low frequency so a whole run of hatch lines
# leans the same way. Period 1/0.075 = 13 units, roughly a quarter of a facet, with
# three finer octaves under it. feDisplacementMap moves by scale * (channel - 0.5), so the
# throw is half of WARP_SCALE either way: about 1.4 units, 2.6 pixels.
#
# That ceiling is not a taste call, it is the one hard limit in this variant. Each face
# owns its own noise field, so the two faces that share a crease displace their two
# drawings of it in different directions, and the throw is how far apart they can get. At
# 1.4 units they read as two pencil passes over one line, which is what a crease should
# look like. Push past about 2 and a black slit opens down the middle of the crease and
# the solid starts to look unglued.
#
# TOOTH is the grain of the paper itself. Period around 1.2 units, so a little over two
# pixels: coarse enough to see as skip, fine enough not to look like a texture map.
WARP_FREQ = (0.062, 0.092)      # per-face range
WARP_SCALE = (2.3, 3.4)
TOOTH_FREQ = (0.72, 1.05)
TOOTH_GAIN = (1.45, 1.95)       # alpha = GAIN * noise + BIAS, clamped to 0..1
TOOTH_BIAS = (-0.40, -0.10)

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


# --- The variance, and the numeral's clearing ------------------------------------
#
# The flat die took each facet's hatch density straight off its Lambert shade. That is
# restored here, with one necessary change: the shade has to come from a light fixed to
# the SOLID, not to the room. The ink is drawn once and then turns with the die, so a
# room-fixed light would bake this orientation's shading into the artwork and the die
# would carry its own highlight around with it as it rolled. --cc-face-lit in the
# stylesheet is the room's light, and it stays a separate thing.
#
# INK_LIGHT is the room light as it falls in the solid's own frame when 20 is forward, so
# the die is inked as if drawn in that pose and then picked up.
INK_LIGHT = frames[face_of_value[20]] @ LIGHT
INK_LIGHT /= np.linalg.norm(INK_LIGHT)

# The flat die's own formula, kept verbatim. Across the twenty faces it yields a step of
# roughly 0.9 to 3.2, a 3.6x spread: some facets nearly solid, some nearly bare. A version
# that forced the twenty faces evenly across the whole range was built and rejected. It
# varies more and looks less like a hand, because an even spread is its own kind of
# regularity. The honest falloff clumps, and hands clump.
tones = [max(0.0, float(normals[i].dot(INK_LIGHT))) for i in range(20)]


def face_step(idx):
    return max(0.75, 3.2 - 2.4 * tones[idx])


# Where the numeral's ink lands on a facet, in that facet's own box. The same solve the
# stylesheet uses to place the figure, so the clearing tracks the type rather than being
# eyeballed against it.
FIG_X, FIG_Y = W / 2, face_r + FIGURE_DROP / magnify
FIG_RX, FIG_RY = 10.0, 7.6


def clearance(x, y):
    """1 out on the facet, dropping where the number sits.

    Not a hole. The pen still crosses the figure, it just lifts more often, so the
    numeral keeps some bare ground under it without the facet showing a bald ellipse.
    This is what stops a number reading as though the hatching runs straight through it.
    """
    r = (((x - FIG_X) / FIG_RX) ** 2 + ((y - FIG_Y) / FIG_RY) ** 2) ** .5
    if r >= 1.3:
        return 1.0
    if r <= 1.0:
        return 0.34
    return 0.34 + 0.66 * (r - 1.0) / 0.3


def hatch(poly, angle, step0, grad_dir):
    """Pen strokes across a triangle: clipped to it, barely jittered, and broken.

    Three things keep this from filling the facet in.

    The pen lifts. It is down for a few units, up for a gap, down again. Where it is up
    there is bare ground, and that bare ground is the grey. Nothing here fills anything.

    The spacing drifts across the facet, closing towards one side and opening towards the
    other, so a single angle never lays an even tone.

    And it lifts more often under the numeral, so the figure keeps some paper.

    Geometrically this is flatter than a pen-only generator would be: 30 samples along a
    line instead of 48, and a twentieth of a unit of jitter instead of a fifth. The wander
    is the paper filter's job. Geometric wobble underneath a displacement field only reads
    as noise on noise, and costs bytes to say so.
    """
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    cx, cy = sum(xs) / 3, sum(ys) / 3
    ca, sa = float(np.cos(angle)), float(np.sin(angle))
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    du = 2 * span / 29                                  # sample spacing along a line

    lines, t = [], -span
    while t <= span:
        frac = (t + span) / (2 * span)
        if grad_dir < 0:
            frac = 1 - frac
        step = step0 * (0.82 + 0.52 * frac)

        if random.random() < .07:                       # a line the hand simply skipped
            t += step * random.uniform(.82, 1.18)
            continue

        seg, down, run, u = [], False, 0.0, -span
        while u <= span:
            x, y = cx + ca * u - sa * t, cy + sa * u + ca * t
            on = inside(poly, x, y)
            if on:
                run -= du
                if run <= 0:
                    if down:
                        down, run = False, random.uniform(0.8, 2.6)     # pen up
                    else:
                        down = random.random() < clearance(x, y)
                        run = random.uniform(4.0, 13.0)                 # pen down
                        if down:
                            seg = []
            if on and down:
                seg.append((x + random.uniform(-.05, .05), y + random.uniform(-.05, .05)))
            elif seg:
                if len(seg) > 1:
                    lines.append(seg)
                seg, down = [], False
            u += du
        if len(seg) > 1:
            lines.append(seg)
        t += step * random.uniform(.82, 1.18)
    return lines


grain = []          # the per-face paper, kept so the CSS can hook each face to its own


def paper(idx):
    """This face's filter: its warp field, its tooth, and the SVG that carries them.

    One filter per face, wrapping the whole drawing, not one per stroke. Chromium runs
    it once over the face's own little raster and the result is reused while the die
    turns, which is what keeps twenty of these affordable.

    The primitives, in order:
      warp    low-frequency fractal noise, four octaves. The finest of them lands at
              roughly the hatch spacing, so neighbouring lines crowd and open as well
              as lean together, which is what stops the field reading as corduroy
      drawn   the whole face displaced by it, R across and G down
      tooth   high-frequency fractal noise, the paper itself
      grain   that noise as an alpha ramp, gain and bias drawn per face
      (out)   `in` composite, so the ink keeps only the alpha the paper gives it

    color-interpolation-filters is set from the stylesheet rather than as an attribute:
    CLAUDE.md's no-inline-CSS rule covers presentation attributes too, and this way the
    look stays restylable alongside the rest of the ink.
    """
    p = dict(wf=random.uniform(*WARP_FREQ), ws=random.uniform(*WARP_SCALE),
             tf=random.uniform(*TOOTH_FREQ), gain=random.uniform(*TOOTH_GAIN),
             bias=random.uniform(*TOOTH_BIAS),
             s1=random.randrange(1, 9999), s2=random.randrange(1, 9999),
             hw=HATCH_WIDTH * random.uniform(0.86, 1.20),
             ew=EDGE_WIDTH * random.uniform(0.88, 1.16))
    grain.append(p)
    return (
        f'<defs><filter id="cc-paper-{idx}" class="cc-d20-3d__paper" '
        f'x="-14%" y="-14%" width="128%" height="128%">'
        f'<feTurbulence type="fractalNoise" baseFrequency="{p["wf"]:.4f}" '
        f'numOctaves="4" seed="{p["s1"]}" result="warp"/>'
        f'<feDisplacementMap in="SourceGraphic" in2="warp" scale="{p["ws"]:.2f}" '
        f'xChannelSelector="R" yChannelSelector="G" result="drawn"/>'
        f'<feTurbulence type="fractalNoise" baseFrequency="{p["tf"]:.4f}" '
        f'numOctaves="4" seed="{p["s2"]}" result="tooth"/>'
        f'<feColorMatrix in="tooth" type="matrix" result="grain" values="'
        f'0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 {p["gain"]:.3f} 0 0 0 {p["bias"]:.3f}"/>'
        f'<feComposite in="drawn" in2="grain" operator="in"/>'
        f'</filter>'
        # The numeral's own filter. Same warp field, a third of the throw, and the tooth
        # left out. The figure needs to sit on the same sheet as the ink around it, or it
        # reads as type pasted onto a drawing, but at 26 units tall it cannot afford to
        # have holes punched in it the way the hatching can.
        f'<filter id="cc-figure-{idx}" class="cc-d20-3d__paper" '
        f'x="-20%" y="-20%" width="140%" height="140%">'
        f'<feTurbulence type="fractalNoise" baseFrequency="{p["wf"]:.4f}" '
        f'numOctaves="3" seed="{p["s1"]}" result="warp"/>'
        f'<feDisplacementMap in="SourceGraphic" in2="warp" scale="{p["ws"] * 0.34:.2f}" '
        f'xChannelSelector="R" yChannelSelector="G"/>'
        f'</filter></defs>')


def art(idx):
    """One face's SVG: its paper, then the hatching and the three inked edges on it."""
    f, R = faces[idx], frames[idx]
    c = V[list(f)].mean(axis=0)
    poly = [to_local(Vw[i], R, c) for i in f]

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" '
           f'class="cc-d20-3d__art" preserveAspectRatio="none" aria-hidden="true">',
           paper(idx),
           # Everything the face draws goes through the filter together, plate included,
           # so the facet's silhouette warps with the strokes lying on it instead of
           # cutting a clean vector edge underneath them.
           '<g class="cc-d20-3d__ink">',
           f'<polygon class="cc-d20-3d__plate" points="'
           + ' '.join(f'{x:.2f},{y:.2f}' for x, y in poly) + '"/>',
           '<g class="cc-d20-3d__hatch">']
    for seg in hatch(poly, random.uniform(0, np.pi), face_step(idx),
                     1 if random.random() < .5 else -1):
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
    out.append('</g></g></svg>')
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

# --- The paper, hooked up -------------------------------------------------------
#
# Each face's ink group is pointed at that face's own filter from here rather than from a
# filter= attribute in the markup, for the same reason the transforms live in CSS: the JS
# carries no styling, and the whole look stays overridable from one stylesheet.

css += ["",
        "/* Filters run in sRGB. The default is linearRGB, which pushes the tooth mask's",
        "   midtones around and makes the grain read grey rather than as skipped ink. */",
        ".cc-d20-3d__paper { color-interpolation-filters: sRGB; }",
        "",
        "/* The filter region reaches past the viewBox, and so do the wobbled vertices.",
        "   Without this the UA rule svg:root { overflow: hidden } cuts a dead-straight",
        "   line across every corner that pokes out, which is all twenty of them. */",
        ".cc-d20-3d__art { overflow: visible; }",
        "",
        "/* Each face on its own paper, and holding its own pencil. The weights vary by a",
        "   sixth either way; the seeds and frequencies vary much more, which is where the",
        "   twenty faces stop being one swatch turned twenty ways. */"]
for i, p in enumerate(grain):
    css.append(f".cc-d20-3d__face--f{i} {{"
               f" --cc-d20-hatch-width: {p['hw']:.3f};"
               f" --cc-d20-edge-width: {p['ew']:.3f}; }}")
    css.append(f".cc-d20-3d__face--f{i} .cc-d20-3d__ink {{ filter: url(#cc-paper-{i}); }}")
    css.append(f".cc-d20-3d__face--f{i} .crawling-clock__value "
               f"{{ filter: url(#cc-figure-{i}); }}")

CSS_OUT.write_text("\n".join(css) + "\n")

print(f"scale {S:.3f}  inradius {inradius:.3f}  face r {face_r:.3f} "
      f"(x{magnify:.4f} = {face_r * magnify:.3f}, target {TARGET_FACE_R:.3f})")
print("face element", f"{W:.2f} x {H:.2f}", "units")
print("values by face:", [value_of_face[i] for i in range(20)])
print("wrote", JS_OUT.relative_to(REPO), f"({JS_OUT.stat().st_size // 1024} KB)")
print("wrote", CSS_OUT.relative_to(REPO), f"({CSS_OUT.stat().st_size // 1024} KB)")
