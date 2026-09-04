"""Build the Crawling Clock's d20: where its twenty faces sit, and what each reads.

    npm run gen:d20

Two files come out, and neither has any appearance in it:

    module/styles/crawling-clock-d20.css   where each face sits, and how the die turns
    module/src/crawling-clock-d20.js       which number is on which face

There is no randomness here and no drawing. A facet is a CSS triangle that the
stylesheet colours; the solid is twenty of them turned into their own planes. What a
facet looks like is crawling-clock.css's business.

Coordinates are CSS's: x right, y down, z towards the viewer. Every vector here can go
straight into a matrix3d() without a flip. The vertex set is symmetric under y -> -y, so
reading the usual construction in this frame still gives a true icosahedron.
"""
import pathlib

import numpy as np

FACES = 20
REPO = pathlib.Path(__file__).resolve().parents[2]

# The flat die's centre facet, in the die's own 100-unit box. Its base measured 49.3
# units across, which for an equilateral triangle fixes the circumradius the front face
# has to project to. Everything below is scaled to hit this number.
TARGET_FACE_R = 49.3 / 3 ** 0.5

# Perspective distance, as a multiple of the die's width. Shallow enough that the far
# facets do not smear, deep enough that the solid reads as a solid.
PERSPECTIVE = 5.0

# The counter's box sat at 55 units in the flat die while the facet's centroid was at
# 50.03, so the numbers were fitted 4.97 units below centre. Reproduce that offset or
# every value in the fitting table in crawling-clock.css is wrong by the same amount.
FIGURE_DROP = 55.0 - (21.5 + 64.3 + 64.3) / 3

# The number on each face, indexed by face.
#
# Frozen data, not a shuffle. It must not move: the numeral fitting table in
# crawling-clock.css and every player's memory of the die are keyed off it. Opposite
# faces sum to 21, as on a real d20, asserted below rather than constructed so that a
# bad edit here fails loudly.
NUMBERING = [14, 10, 8, 15, 18, 5, 20, 12, 4, 2, 19, 17, 9, 1, 3, 6, 16, 13, 11, 7]

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
assert len(faces) == FACES, len(faces)

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

# The face element's box: the triangle's bounding box, width the edge, height 1.5 * the
# circumradius, apex at the top.
W, H = face_r * 3 ** 0.5, face_r * 1.5

# --- Numbering ------------------------------------------------------------------

value_of_face = dict(enumerate(NUMBERING))
face_of_value = {v: f for f, v in value_of_face.items()}
assert sorted(value_of_face.values()) == list(range(1, FACES + 1)), "1-20, once each"

# The faces come in antipodal pairs; check the numbering respects them rather than
# trusting the constant.
for i, f in enumerate(faces):
    c = V[list(f)].mean(axis=0)
    j = next(k for k, g in enumerate(faces)
             if np.allclose(V[list(g)].mean(axis=0), -c, atol=1e-9))
    assert value_of_face[i] + value_of_face[j] == 21, \
        f"faces {i}/{j} carry {value_of_face[i]}/{value_of_face[j]}, not 21"

# --- Each face's frame ----------------------------------------------------------
#
# A face is a plane element in CSS, so it needs a local frame: x across, y *down* the
# face, z out of it. Build it from the outward normal and the vertex chosen as the
# numeral's apex, then read the frame off as the columns of a matrix3d.
#
# A is derived as B x C rather than picked, which forces det[A B C] = +1. A frame that
# came out left-handed would render every face mirrored, and the numbers with it.

frames = []
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
    frames.append(R)


def m3(M):
    """A 3x3 rotation as CSS matrix3d(), which is column-major."""
    cols = [f"{M[r, c]:.6f}" for c in range(3) for r in range(3)]
    return ("matrix3d(" + ", ".join(cols[0:3]) + ", 0, " + ", ".join(cols[3:6]) +
            ", 0, " + ", ".join(cols[6:9]) + ", 0, 0, 0, 0, 1)")


def orientation(value):
    """The rotation that brings `value`'s face square to the viewer.

    The transpose of that face's own frame. Swapping between two of these is the whole
    animation: the browser decomposes both matrices and slerps the rotation, so the die
    takes the short way round on its own.
    """
    return frames[face_of_value[value]].T


# --- Emit -----------------------------------------------------------------------

BANNER = ("Generated by tools/d20/d20.py -- do not edit by hand.\n"
          "\n"
          "The die as a solid: where its twenty faces sit, how it turns to bring one\n"
          "forward, and which number each carries. Nothing here says what a facet looks\n"
          "like; that is crawling-clock.css.\n")


def css():
    out = [f"/* {BANNER.rstrip()} */", "",
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
           "}",
           "",
           "/* Where each face sits on the solid. matrix3d turns the element into the face's",
           "   plane; translateZ then walks it out to the surface along its own normal, which",
           "   is exactly the inradius. */"]
    out += [f".cc-d20-3d__face--f{i} {{ transform: {m3(frames[i])} "
            "translateZ(var(--cc-d20-inradius)); }" for i in range(FACES)]

    out += ["",
            "/* One orientation per value: the rotation that brings that face square to the",
            "   viewer. Swapping between two of these is the whole animation -- the browser",
            "   decomposes both matrices and slerps, so the die takes the short way round. */"]
    out += [f".cc-d20-3d__body--to{v} {{ transform: {m3(orientation(v))}; }}"
            for v in range(1, FACES + 1)]
    return "\n".join(out) + "\n"


def js():
    out = [f"// {line}".rstrip() for line in BANNER.split("\n")]
    out += [
        "",
        "// The number on each face, indexed by face. Opposite faces sum to 21.",
        "export const CRAWLING_CLOCK_D20_VALUES = ["
        + ", ".join(str(value_of_face[i]) for i in range(FACES)) + "];",
        "",
        "// The clock runs 20 down to 1 and every one of those is a real face, so the die",
        "// never has to lie about what it reads.",
        "export const CRAWLING_CLOCK_D20_MIN = 1;",
        f"export const CRAWLING_CLOCK_D20_MAX = {FACES};",
        "",
    ]
    return "\n".join(out)


if __name__ == "__main__":
    (REPO / "module/styles/crawling-clock-d20.css").write_text(css())
    (REPO / "module/src/crawling-clock-d20.js").write_text(js())
    print("wrote module/styles/crawling-clock-d20.css and module/src/crawling-clock-d20.js")
