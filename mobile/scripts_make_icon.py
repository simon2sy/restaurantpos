from PIL import Image, ImageDraw
import os

BASE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(BASE, "assets")

# Palette
BG      = (15, 23, 42)     # #0f172a dark navy (matches app backgroundColor)
BG_SOFT = (30, 41, 59)     # #1e293b slightly lighter plate fill
GOLD    = (245, 158, 11)   # #f59e0b amber accent
CREAM   = (248, 250, 252)  # #f8fafc near-white

def draw_fork_and_knife(draw, cx, cy, scale, color):
    """Draw a fork (left) and knife (right) emblem centered on (cx, cy)."""
    # center gap between the two
    gap = 90 * scale
    half_w = 150 * scale
    f_cx = cx - gap // 2 - half_w // 2   # fork center x
    k_cx = cx + gap // 2 + half_w // 2   # knife center x

    # ---------- FORK ----------
    tine_w   = 26 * scale
    tine_gap = 12 * scale
    top_y    = cy - 190 * scale
    crotch_y = cy - 78 * scale
    handle_top = cy + 40 * scale
    handle_bot = cy + 210 * scale
    tines = 4
    tine_xs = []
    for i in range(tines):
        t0 = f_cx - (tines - 1) * (tine_w + tine_gap) / 2 + i * (tine_w + tine_gap)
        tine_xs.append(t0)
        # tine
        draw.rounded_rectangle(
            [t0, top_y, t0 + tine_w, crotch_y],
            radius=int(6*scale), fill=color)
    # crotch / shoulders
    inner_l = tine_xs[0] + tine_w
    inner_r = tine_xs[-1] + tine_w
    # bowl curve connecting tines bottoms
    draw.pieslice(
        [inner_l, crotch_y - (tine_w//2), inner_r, crotch_y + tine_w],
        180, 360, fill=color)
    # neck narrowing into handle
    neck_w = 42 * scale
    draw.rectangle([f_cx - neck_w//2, crotch_y, f_cx + neck_w//2, handle_top], fill=color)
    # handle
    draw.rounded_rectangle(
        [f_cx - 34*scale, handle_top, f_cx + 34*scale, handle_bot],
        radius=int(16*scale), fill=color)

    # ---------- KNIFE ----------
    blade_top = cy - 190 * scale
    blade_bot = cy - 68 * scale
    blade_w   = 44 * scale
    # rounded tip
    draw.rounded_rectangle(
        [k_cx - blade_w//2, blade_top - 10*scale, k_cx + blade_w//2, blade_bot],
        radius=int(16*scale), fill=color)
    # tapered tip point
    draw.polygon(
        [(k_cx - blade_w//2, blade_top - 10*scale),
         (k_cx + blade_w//2, blade_top - 10*scale),
         (k_cx, blade_top - 60*scale)], fill=color)
    # handle (offset outward a bit)
    h_off = 6 * scale
    draw.rounded_rectangle(
        [k_cx - 34*scale + h_off, blade_bot, k_cx + 34*scale + h_off, cy + 210*scale],
        radius=int(16*scale), fill=color)

def draw_emblem(size, with_bg=True):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    scale = size / 1024.0
    cx, cy = size / 2, size / 2

    if with_bg:
        d.rounded_rectangle([0, 0, size - 1, size - 1],
                            radius=int(size*0.2), fill=BG)

        # plate ring
        ring_r = int(330 * scale)
        d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                  outline=GOLD, width=int(18*scale))
        # inner plate fill
        inner_r = int(272 * scale)
        d.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
                  fill=BG_SOFT)

    draw_fork_and_knife(d, cx, cy, scale, GOLD)

    return im

# ---- icon.png : 1024 solid, full-bleed ----
icon = draw_emblem(1024, with_bg=True).convert("RGB")
icon.save(os.path.join(ASSETS, "icon.png"))

# ---- adaptive-icon.png : 1024 transparent, emblem in safe zone ----
# Safe zone is central ~66% diameter (~676px). Scale up for presence but stay inside.
im2 = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
d2 = ImageDraw.Draw(im2)
draw_fork_and_knife(d2, 512, 512, 0.82, GOLD)
im2.save(os.path.join(ASSETS, "adaptive-icon.png"))

# ---- splash.png : transparent emblem centered, app will use contain on BG ----
im3 = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
d3 = ImageDraw.Draw(im3)
draw_fork_and_knife(d3, 512, 512, 0.5, GOLD)
im3.save(os.path.join(ASSETS, "splash.png"))

print("Generated:", [f for f in ["icon.png", "adaptive-icon.png", "splash.png"]
                     if os.path.exists(os.path.join(ASSETS, f))])
for f in ["icon.png", "adaptive-icon.png", "splash.png"]:
    p = os.path.join(ASSETS, f)
    im = Image.open(p)
    print(f, im.size, im.mode, os.path.getsize(p), "bytes")