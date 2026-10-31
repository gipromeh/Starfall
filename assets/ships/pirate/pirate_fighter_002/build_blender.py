"""
STARFALL — пиратский истребитель v2 (Blender 5.0, запуск из Text Editor).

Куда вставить: вкладка Scripting → в Text Editor «New» → вставить весь код → ▶ Run Script (Alt+P).
Строит корабль в коллекции PirateShip (повторный запуск пересоздаёт его), с нуля рисует текстуры (≈20–40 с),
печатает отчёт по ТЗ. Чтобы получить GLB, впиши путь в EXPORT_PATH, например r"C:\\Users\\alexm\\Desktop\\pirate_v2.glb".

Что внутри: корпус-лофт, шестиугольные крылья, 4 орудия (двуствольные на каждом крыле), гондолы, сопла, шипы, плавник,
кабина; текстуры: покраска, панели и заклёпки, ржавчина, сколы краски по кромкам, царапины, череп с костями,
надписи «ARRR» и «VOID 13», метки побед, жёлто-чёрные полосы. Контракт STARFALL: после осевой коррекции игровой нос glTF направлен по -Z; 1 ед. = 1 м, центр в нуле.
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Matrix, Vector

EXPORT_PATH = ""        # пусто = только построить, без экспорта
SAVE_TEX_DIR = ""       # папка, куда сохранить текстуры PNG для просмотра (необязательно)
SEED = 13               # меняй, чтобы получить другой износ и царапины
COLL = "PirateShip"
ATLAS = 2048            # атлас цвета; ORM и нормали уменьшаются до половины
Q = ATLAS // 2          # размер одной четверти атласа

# ---------------------------------------------------------------- очистка прошлого запуска
old = bpy.data.collections.get(COLL)
if old:
    for o in list(old.objects):
        me = o.data if o.type == 'MESH' else None
        bpy.data.objects.remove(o, do_unlink=True)
        if me and me.users == 0:
            bpy.data.meshes.remove(me)
    bpy.data.collections.remove(old)
for coll_ in (bpy.data.materials, bpy.data.images, bpy.data.node_groups):
    for it in list(coll_):
        if it.name.startswith("pirate_"):
            coll_.remove(it)
coll = bpy.data.collections.new(COLL)
bpy.context.scene.collection.children.link(coll)

# ---------------------------------------------------------------- геометрия: помощники
def ring(bm, y, w, h, zc, n=10, e=2.6):
    vs = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c, s = math.cos(a), math.sin(a)
        vs.append(bm.verts.new((w * math.copysign(abs(c) ** (2 / e), c), y, zc + h * math.copysign(abs(s) ** (2 / e), s))))
    return vs

def loft(bm, secs, nose, tail):
    rings = [ring(bm, *s) for s in secs]
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    for r, p in ((rings[-1], nose), (rings[0], tail)):
        c = bm.verts.new(p)
        for i in range(n):
            bm.faces.new((r[i], r[(i + 1) % n], c))

def plate(bm, pts, nrm, t):
    nrm = Vector(nrm)
    top = [bm.verts.new(Vector(p) + nrm * t / 2) for p in pts]
    bot = [bm.verts.new(Vector(p) - nrm * t / 2) for p in pts]
    bm.faces.new(top)
    bm.faces.new(bot[::-1])
    n = len(pts)
    for i in range(n):
        bm.faces.new((top[i], top[(i + 1) % n], bot[(i + 1) % n], bot[i]))

def cone_y(bm, pos, r_back, r_front, depth, seg=8):
    m = Matrix.Translation(pos) @ Matrix.Rotation(math.radians(-90), 4, 'X')
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r_back, radius2=r_front, depth=depth, matrix=m)

def ball(bm, pos, r):
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=Matrix.Translation(pos))

def mirror_x(bm, faces):
    vm = {}
    for f in faces:
        vs = []
        for v in f.verts:
            if v not in vm:
                vm[v] = bm.verts.new((-v.co.x, v.co.y, v.co.z))
            vs.append(vm[v])
        bm.faces.new(vs[::-1])

WING = [(.8, 2.0), (3.6, .9), (5.4, -1.4), (4.6, -3.6), (2.2, -3.4), (.8, -2.6)]    # контур правого крыла (X, Y)
GUN_X, GUN_Y, GUN_Z = 2.6, 1.6, -.34                                                  # казённик пушки на крыле

# ---------------------------------------------------------------- корпус, крылья, оружие (материал hull)
hull = bmesh.new()
secs = [(-4.2, .90, .70, .00), (-3.6, 1.25, .95, .05), (-1.5, 1.10, .85, .10),
        (1.0, .80, .60, .05), (3.2, .45, .32, -.02), (5.0, .18, .14, -.05)]
loft(hull, secs, nose=(0, 5.5, -.06), tail=(0, -4.45, 0))

start = len(hull.faces)                                   # дальше — одна сторона (+X), потом зеркалим
plate(hull, [(x, y, -.2) for x, y in WING], (0, 0, 1), .14)
cone_y(hull, (5.0, -1.2, -.2), .26, .16, 3.4)             # гондола на конце крыла
cone_y(hull, (.62, -4.9, 0), .46, .34, 1.2)               # сопло двигателя
cone_y(hull, (GUN_X, GUN_Y - .8, GUN_Z), .24, .20, 1.8)   # казённик орудия
for dx in (-.14, .14):                                    # двуствольная пушка
    cone_y(hull, (GUN_X + dx, GUN_Y + 1.6, GUN_Z), .07, .06, 2.6)      # ствол
    cone_y(hull, (GUN_X + dx, GUN_Y + 2.85, GUN_Z), .11, .11, .18)     # дульный тормоз
mirror_x(hull, list(hull.faces)[start:])

plate(hull, [(0, -4.0, .8), (0, -1.2, .85), (0, -4.8, 2.7)], (1, 0, 0), .12)    # спинной плавник
cone_y(hull, (0, 6.5, -.06), .26, 0.0, 2.2)               # таранный шип
cone_y(hull, (0, 4.4, 1.1), .18, 0.0, 1.5)                # шип на спине

# ---------------------------------------------------------------- свечение (материал glow)
glow = bmesh.new()
s0 = len(glow.faces)
cone_y(glow, (.62, -5.5, 0), .31, .31, .06)               # пламя двигателя
ball(glow, (5.0, -2.95, -.2), .16)                        # огонёк гондолы
ball(glow, (.38, 4.0, .28), .11)                          # «глаза»-фонари на носу
for dx in (-.14, .14):
    ball(glow, (GUN_X + dx, GUN_Y + 2.98, GUN_Z), .07)    # свет в дульных срезах
mirror_x(glow, list(glow.faces)[s0:])

# ---------------------------------------------------------------- кабина (материал glass)
glass = bmesh.new()
bmesh.ops.create_uvsphere(glass, u_segments=10, v_segments=6, radius=1.0)
for v in glass.verts:
    v.co = Vector((v.co.x * .55, v.co.y * 1.1 + 1.1, v.co.z * .5 + .55))
bmesh.ops.delete(glass, geom=[v for v in glass.verts if v.co.z < .5], context='VERTS')

# ---------------------------------------------------------------- центр габаритов в ноль
bms = {"hull": hull, "glow": glow, "cockpit": glass}
allv = [v.co.copy() for b in bms.values() for v in b.verts]
lo = Vector((min(p.x for p in allv), min(p.y for p in allv), min(p.z for p in allv)))
hi = Vector((max(p.x for p in allv), max(p.y for p in allv), max(p.z for p in allv)))
ctr = (lo + hi) / 2
for b in bms.values():
    bmesh.ops.translate(b, vec=-ctr, verts=b.verts)
span = hi - lo

# ---------------------------------------------------------------- нормали, треугольники
for b in bms.values():
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    bmesh.ops.triangulate(b, faces=b.faces)
    b.normal_update()

# ---------------------------------------------------------------- развёртка корпуса: плоские проекции в четверти атласа
PPM = Q / (max(span.x, span.y) + 0.6)                     # пикселей на метр в четверти
uvl = hull.loops.layers.uv.new("UVMap")
for f in hull.faces:
    n = f.normal
    ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
    for l in f.loops:
        p = l.vert.co
        if az >= ax and az >= ay:                         # верх (0,Q) / низ (Q,0): (x, y)
            px, py = p.x * PPM + Q / 2, p.y * PPM + Q / 2
            co, ro = (0, Q) if n.z > 0 else (Q, 0)
        elif ax >= ay:                                    # борта (Q,Q): (y, z); левый борт зеркально, чтобы надписи читались
            px, py = (p.y if n.x > 0 else -p.y) * PPM + Q / 2, p.z * PPM + Q / 2
            co, ro = Q, Q
        else:                                             # нос/корма (0,0): (x, z)
            px, py = p.x * PPM + Q / 2, p.z * PPM + Q / 2
            co, ro = 0, 0
        l[uvl].uv = ((co + px) / ATLAS, (ro + py) / ATLAS)

# ================================================================ ТЕКСТУРЫ (numpy, без внешних файлов)
def vnoise(h, w, cells, seed):
    g = np.random.default_rng(seed).random((cells + 1, cells + 1)).astype(np.float32)
    ys = np.linspace(0, cells, h, endpoint=False, dtype=np.float32)
    xs = np.linspace(0, cells, w, endpoint=False, dtype=np.float32)
    yi, xi = ys.astype(int), xs.astype(int)
    fy, fx = ys - yi, xs - xi
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b = g[yi][:, xi], g[yi][:, xi + 1]
    c, d = g[yi + 1][:, xi], g[yi + 1][:, xi + 1]
    fx, fy = fx[None, :], fy[:, None]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

def fbm(shape, base, octv, seed):
    out = np.zeros(shape, np.float32); amp, norm, c = .5, 0., base
    for o in range(octv):
        out += amp * vnoise(shape[0], shape[1], c, seed + o * 17); norm += amp; amp *= .5; c *= 2
    return out / norm

def sm(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def mixc(c1, c2, m):                                      # c1,c2: (...,3); m: (...)
    return c1 * (1 - m[..., None]) + c2 * m[..., None]

def poly_dist(X, Y, pts):
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    sgn = 1 if area > 0 else -1
    inside = np.ones(X.shape, bool); d = np.full(X.shape, 1e9, np.float32)
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        ex, ey = x2 - x1, y2 - y1
        inside &= (ex * (Y - y1) - ey * (X - x1)) * sgn >= 0
        t = np.clip(((X - x1) * ex + (Y - y1) * ey) / (ex * ex + ey * ey), 0, 1)
        d = np.minimum(d, np.hypot(X - (x1 + t * ex), Y - (y1 + t * ey)))
    return inside, d

FONT = {   # 5×7; добавляй свои буквы по образцу
    'A': [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    'R': ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    'V': ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    'O': [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    'I': ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    'D': ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    '1': ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    '3': ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    ' ': ["....."] * 7,
}

def text_mask(A, B, txt, x0, y0, h):
    """надпись высотой h метров, левый нижний угол (x0, y0); работает по всему массиву сразу"""
    cell = h / 7.0
    gl = np.array([[[1 if ch == '#' else 0 for ch in row] + [0] for row in FONT[c]] for c in txt], np.uint8)   # (n,7,6)
    u, v = (A - x0) / cell, (B - y0) / cell
    gi, cx, cy = np.floor(u / 6).astype(int), np.floor(u % 6).astype(int), np.floor(v).astype(int)
    ok = (gi >= 0) & (gi < len(txt)) & (cy >= 0) & (cy < 7)
    out = np.zeros(A.shape, bool)
    out[ok] = gl[gi[ok], 6 - cy[ok], cx[ok]] > 0
    return out

def skull_masks(U, V):
    """череп со скрещёнными костями; U,V — метры от центра. Возвращает (светлое, тёмное)"""
    d1, d2 = (U - V) / 1.4142, (U + V) / 1.4142
    bones = ((np.abs(d1) < .075) & (np.abs(d2) < .9)) | ((np.abs(d2) < .075) & (np.abs(d1) < .9))
    for sx in (-1, 1):
        for sy in (-1, 1):
            bones |= np.hypot(U - sx * .62, V - sy * .62 + sy * 0.0) < .13 if False else np.hypot(U - sx * .64, V - sy * .64) < .13
    cran = np.hypot(U, V - .12) < .5
    jaw = (np.abs(U) < .27) & (V > -.55) & (V < -.1)
    skull = cran | jaw
    dark = (np.hypot(U - .2, V - .1) < .13) | (np.hypot(U + .2, V - .1) < .13) | (np.hypot(U, V + .08) < .06)
    for tx in (-.15, -.05, .05, .15):
        dark |= (np.abs(U - tx) < .014) & (V > -.55) & (V < -.28)
    dark |= ((np.abs(V + .55) < .02) & (np.abs(U) < .27))
    return bones | skull, dark & skull

def scratches(shape, n, seed, lmin=30, lmax=240):
    rng = np.random.default_rng(seed); m = np.zeros(shape, bool); h, w = shape
    for _ in range(n):
        L = int(rng.integers(lmin, lmax)); a = rng.random() * math.pi
        x0, y0 = rng.random() * w, rng.random() * h
        t = np.arange(L)
        xs = (x0 + t * math.cos(a)).astype(int); ys = (y0 + t * math.sin(a)).astype(int)
        k = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
        m[ys[k], xs[k]] = True
    return m

def grid(a, step):
    return np.abs(((a / step) + .5) % 1 - .5) * step

def surface(A, B, seed, base, extra_chip=None, rust_bias=None):
    """износ поверх базовой краски: панели, заклёпки, ржавчина, сколы, царапины"""
    sh = A.shape
    n1 = fbm(sh, 4, 5, seed); n2 = fbm(sh, 24, 3, seed + 5); n3 = fbm(sh, 90, 2, seed + 9)
    col = base * (.82 + .36 * n1)[..., None]
    rough = (.5 + .2 * n2).astype(np.float32); metal = np.zeros(sh, np.float32)
    ao = np.ones(sh, np.float32); h = (.3 * n2 + .1 * n3).astype(np.float32)
    dx, dy = grid(A, 1.3), grid(B, 1.7)                    # линии панелей
    line = (dx < .014) | (dy < .014)
    col[line] *= .35; ao[line] = .55; h[line] -= .3
    riv = np.hypot(np.abs(dx - .07), grid(B, .25)) < .022  # заклёпки вдоль вертикальных швов
    col[riv] = col[riv] * .5 + .25; h[riv] += .35
    r = fbm(sh, 6, 5, seed + 40)                           # ржавчина
    rust = sm(.58, .72, r)
    if rust_bias is not None: rust = np.clip(rust + rust_bias, 0, 1)
    rcol = np.array([.38, .15, .05], np.float32) * (.6 + .8 * n3)[..., None]
    col = mixc(col, rcol, rust * .85); rough = rough * (1 - rust) + .85 * rust; ao -= .25 * rust
    chip = sm(.66, .72, fbm(sh, 60, 3, seed + 50)) * sm(.45, .7, n1)     # сколы краски
    if extra_chip is not None: chip = np.maximum(chip, extra_chip)
    bare = np.array([.62, .62, .66], np.float32) * (.8 + .4 * n3)[..., None]
    col = mixc(col, bare, chip); rough = rough * (1 - chip) + .3 * chip; metal = metal * (1 - chip) + chip; h -= .15 * chip
    scr = scratches(sh, 220, seed + 60)                    # царапины
    col[scr] = col[scr] * .35 + bare[scr] * .65 * .9; rough[scr] = .35; metal[scr] = .7; h[scr] -= .2
    return col, rough, metal, ao, h

def build_regions():
    rng_seed = SEED
    ii = (np.arange(Q, dtype=np.float32) + .5 - Q / 2) / PPM
    A = np.tile(ii[None, :], (Q, 1)); B = np.tile(ii[:, None], (1, Q))      # A — вдоль u (колонки), B — вдоль v (ряды)
    cx_, cy_, cz_ = ctr.x, ctr.y, ctr.z
    wing = [(x - cx_, y - cy_) for x, y in WING]
    out = {}
    # --- верх: крылья с оранжевой краской, череп, надпись, полосы
    inside, dist = poly_dist(np.abs(A), B, wing)
    n1 = fbm(A.shape, 4, 5, rng_seed + 100)
    outer = inside & (np.abs(A) > 2.0 - cx_ * 0 + (n1 - .5) * .4)
    base = np.empty(A.shape + (3,), np.float32); base[:] = np.array([.13, .14, .16], np.float32)
    base = mixc(base, np.array([.72, .30, .06], np.float32) * (.75 + .5 * n1)[..., None], outer.astype(np.float32))
    edge = inside & (dist < .2 * (.4 + n1))
    chip = edge.astype(np.float32) * sm(.35, .55, fbm(A.shape, 40, 4, rng_seed + 110))
    col, rough, metal, ao, h = surface(A, B, rng_seed + 1, base, extra_chip=chip, rust_bias=edge * .25)
    wear = 1 - .55 * sm(.55, .7, fbm(A.shape, 30, 4, rng_seed + 120))
    sk, dk = skull_masks((A - (3.5 - cx_)) / 1.15, (B - (-.6 - cy_)) / 1.15)            # череп на правом крыле
    sk = sk & inside & (A > 0); dk = dk & sk
    w_ = sk * wear; col = mixc(col, np.array([.9, .88, .8], np.float32) + 0 * col, w_); col = mixc(col, np.full(col.shape, .03, np.float32), (dk * wear).astype(np.float32))
    tm = text_mask(A, B, "ARRR", -4.6 - cx_, -.9 - cy_, .42) & inside & (A < 0)
    col = mixc(col, np.array([.92, .9, .8], np.float32) + 0 * col, (tm * wear).astype(np.float32))
    stripe = inside & (np.abs(A) > 2.3 - cx_ * 0) & (np.abs(A) < 4.4) & (B > -3.25 - cy_) & (B < -2.75 - cy_)
    yb = (((np.abs(A) + B) / .13) % 2 < 1)
    col = mixc(col, np.where(yb[..., None], np.array([.9, .7, .05], np.float32), np.array([.03, .03, .03], np.float32)) + 0 * col, (stripe * wear).astype(np.float32))
    metal = metal * (1 - (sk | tm | stripe) * .9); rough = np.where(sk | tm | stripe, .6, rough)
    out["top"] = (col, rough, metal, ao, h)
    # --- борт: надпись, метки побед
    base = np.empty(A.shape + (3,), np.float32); base[:] = np.array([.13, .14, .16], np.float32)
    col, rough, metal, ao, h = surface(A, B, rng_seed + 2, base)
    wear = 1 - .5 * sm(.55, .7, fbm(A.shape, 30, 4, rng_seed + 130))
    tm = text_mask(A, B, "VOID 13", -2.8 - cy_, -.05 - cz_, .4)
    tally = np.zeros(A.shape, bool)
    for k in range(10):
        y0 = 1.1 - cy_ + .13 * k
        tally |= (A > y0) & (A < y0 + .035) & (B > .0 - cz_) & (B < .3 - cz_)
    mk = (tm | tally)
    col = mixc(col, np.array([.9, .88, .8], np.float32) + 0 * col, (mk * wear).astype(np.float32)); metal *= (1 - mk * .9)
    out["side"] = (col, rough, metal, ao, h)
    # --- нос/корма и низ
    for key, sd in (("front", 3), ("bottom", 4)):
        base = np.empty(A.shape + (3,), np.float32); base[:] = np.array([.11, .12, .14], np.float32)
        out[key] = surface(A, B, rng_seed + sd, base)
    return out

print("PIRATE: рисую текстуры…")
regs = build_regions()
LAYOUT = {"top": (0, Q), "side": (Q, Q), "front": (0, 0), "bottom": (Q, 0)}     # (колонка, ряд) начала четверти
atlas = [np.zeros((ATLAS, ATLAS) + s, np.float32) for s in ((3,), (), (), (), ())]   # col, rough, metal, ao, h
for key, (co, ro) in LAYOUT.items():
    for dst, src in zip(atlas, regs[key]):
        dst[ro:ro + Q, co:co + Q] = src
col_a, rough_a, metal_a, ao_a, h_a = atlas
col_a = np.clip(col_a, 0, 1)

def to_image(name, arr, srgb, size, fmt='PNG'):
    if size != arr.shape[0]:
        k = arr.shape[0] // size
        arr = arr.reshape(size, k, size, k, *arr.shape[2:]).mean(axis=(1, 3))
    rgba = np.ones((size, size, 4), np.float32); rgba[..., :3] = arr
    img = bpy.data.images.new(name, size, size, alpha=False)
    img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'     # ВАЖНО: до записи пикселей, иначе Blender их стирает
    img.file_format = fmt
    img.pixels.foreach_set(rgba.ravel())
    if fmt == 'JPEG':                                      # pack() у сгенерированной картинки теряет JPEG -> пишем файл и грузим обратно
        tmp = os.path.join(bpy.app.tempdir, name + ".jpg")
        img.filepath_raw = tmp
        img.save()
        bpy.data.images.remove(img)
        img = bpy.data.images.load(tmp); img.name = name
        img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    try: img.pack()
    except Exception as e: print("PIRATE: pack:", e)
    return img

orm = np.stack([np.clip(ao_a, 0, 1), np.clip(rough_a, .05, 1), np.clip(metal_a, 0, 1)], axis=-1)
hx, hy = np.gradient(h_a, axis=1), np.gradient(h_a, axis=0)
nrm = np.stack([-hx * 5, -hy * 5, np.ones_like(h_a)], axis=-1)
nrm = nrm / np.linalg.norm(nrm, axis=-1, keepdims=True) * .5 + .5
IMG_BASE = to_image("pirate_basecolor", col_a, True, ATLAS, 'JPEG')
IMG_ORM = to_image("pirate_orm", orm, False, ATLAS // 2)
IMG_NRM = to_image("pirate_normal", nrm, False, ATLAS // 2)
if SAVE_TEX_DIR:
    os.makedirs(SAVE_TEX_DIR, exist_ok=True)
    for im in (IMG_BASE, IMG_ORM, IMG_NRM):
        im.save_render(os.path.join(SAVE_TEX_DIR, im.name + ".png"))

# ---------------------------------------------------------------- материалы (3 штуки)
def principled(m):
    try: m.use_nodes = True                                # в 5.0 помечен устаревшим, но безопасен
    except Exception: pass
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None:
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    return nt, b

def simple_mat(name, color, metallic=0.0, rough=0.6, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); nt, b = principled(m)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metallic; b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'BLENDED'
        elif hasattr(m, 'blend_method'): m.blend_method = 'BLEND'
    return m

def hull_mat():
    m = bpy.data.materials.new("pirate_hull"); nt, b = principled(m)
    N = nt.nodes; L = nt.links
    t_col = N.new('ShaderNodeTexImage'); t_col.image = IMG_BASE
    t_orm = N.new('ShaderNodeTexImage'); t_orm.image = IMG_ORM
    t_nrm = N.new('ShaderNodeTexImage'); t_nrm.image = IMG_NRM
    sep = N.new('ShaderNodeSeparateColor')
    nm = N.new('ShaderNodeNormalMap')
    L.new(t_col.outputs['Color'], b.inputs['Base Color'])
    L.new(t_orm.outputs['Color'], sep.inputs['Color'])
    L.new(sep.outputs['Green'], b.inputs['Roughness'])
    L.new(sep.outputs['Blue'], b.inputs['Metallic'])
    L.new(t_nrm.outputs['Color'], nm.inputs['Color'])
    L.new(nm.outputs['Normal'], b.inputs['Normal'])
    ng = bpy.data.node_groups.new("pirate_glTF Material Output", 'ShaderNodeTree')     # для экспортёра: канал Occlusion
    ng.interface.new_socket(name="Occlusion", in_out='INPUT', socket_type='NodeSocketFloat')
    ng.name = "glTF Material Output"
    g = N.new('ShaderNodeGroup'); g.node_tree = ng
    L.new(sep.outputs['Red'], g.inputs['Occlusion'])
    return m

MATS = {"hull": hull_mat(),
        "glow": simple_mat("pirate_glow", (1, .35, .05), emit=(1, .35, .05), strength=6),
        "cockpit": simple_mat("pirate_glass", (.05, .25, .30), rough=.1, alpha=.45)}

# ---------------------------------------------------------------- в объекты
tris = 0
for name, b in bms.items():
    me = bpy.data.meshes.new(name)
    b.to_mesh(me); b.free()
    me.materials.append(MATS[name])
    for p in me.polygons: p.use_smooth = False
    coll.objects.link(bpy.data.objects.new(name, me))
    tris += len(me.polygons)

# ---------------------------------------------------------------- метки: двигатели и стволы
def empty(name, pos, rz=0.0):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'ARROWS'; e.empty_display_size = .4
    e.location = Vector(pos) - ctr; e.rotation_euler = (0, 0, rz)
    coll.objects.link(e)
for i, sx in enumerate((1, -1)):
    empty(f"ENG_{i}", (sx * .62, -5.5, 0), math.pi)       # метка разворачивается вместе с узлом осевой коррекции
k = 0
for sx in (1, -1):
    for dx in (-.14, .14):
        empty(f"GUN_{k}", (sx * GUN_X + dx, GUN_Y + 3.0, GUN_Z)); k += 1

# ---------------------------------------------------------------- ось игрового полёта: вытянутый нос направлен вперёд
# Внутренний узел разворачивает модель на 180°; внешний корень остаётся свободным для quaternion ИИ.
axis_root = bpy.data.objects.new("STARFALL_PIRATE_ASSET_ROOT", None)
axis_fix = bpy.data.objects.new("STARFALL_FORWARD_AXIS_FIX", None)
coll.objects.link(axis_root); coll.objects.link(axis_fix)
axis_root["starfallForwardAxis"] = "NEGATIVE_Z"
axis_fix["starfallForwardAxis"] = "NEGATIVE_Z"
axis_fix.parent = axis_root
axis_fix.rotation_euler[2] = math.pi
for obj in list(coll.objects):
    if obj not in (axis_root, axis_fix):
        obj.parent = axis_fix

# ---------------------------------------------------------------- отчёт по ТЗ
print("PIRATE: треугольников %d (лимит 9000) | материалов 3 (лимит 3) | габариты X×Y×Z = %.1f × %.1f × %.1f м | нос -Y Blender / -Z glTF | текстуры: цвет %d, ORM и нормали %d px"
      % (tris, span.x, span.y, span.z, ATLAS, ATLAS // 2))

# ---------------------------------------------------------------- экспорт GLB
if EXPORT_PATH:
    try: bpy.ops.object.select_all(action='DESELECT')
    except Exception: pass
    for o in coll.objects: o.select_set(True)
    want = dict(filepath=EXPORT_PATH, export_format='GLB', export_yup=True, export_apply=True, use_selection=True,
                export_cameras=False, export_lights=False, export_extras=True, export_animations=False,
                export_skins=False, export_morph=False, export_tangents=False, export_materials='EXPORT',
                export_image_format='AUTO')
    have = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    bpy.ops.export_scene.gltf(**{k_: v for k_, v in want.items() if k_ in have})
    print("PIRATE: экспорт ->", EXPORT_PATH, "| размер %.2f МБ" % (os.path.getsize(EXPORT_PATH) / 1048576),
          "| параметры, которых нет в этой версии:", sorted(set(want) - have))
