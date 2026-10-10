#!/usr/bin/env python3
"""素材后处理 v2：验证 alpha → 擦除右下角水印 → 裁透明边 → 规格化。用 venv python 运行。"""
from PIL import Image
import os

RAW = os.path.join(os.path.dirname(__file__), "..", "assets", "raw")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sprites")
os.makedirs(OUT, exist_ok=True)

def info(img: Image.Image) -> str:
    return f"mode={img.mode} size={img.size}"

def has_real_alpha(img: Image.Image) -> bool:
    if img.mode != "RGBA":
        return False
    lo, _hi = img.getchannel("A").getextrema()
    return lo < 200

def keyout_white(img: Image.Image, thresh: int = 200) -> Image.Image:
    """背景抠除（泛洪填充版）：从图像边界出发，清除连通的浅色低饱和背景。
    模型会把'透明棋盘格'画进像素（RGB 无 alpha），阈值法会漏掉深色棋盘格或误伤银白鱼腹——
    泛洪只清除与边界连通的背景区，内部浅色（鱼腹高光）不受影响。"""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    from collections import deque

    def is_bg(x: int, y: int) -> bool:
        r, g, b, _a = px[x, y]
        lum = (r + g + b) / 3
        return lum >= thresh and abs(r - g) < 22 and abs(g - b) < 22 and abs(r - b) < 22

    visited = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y) and not visited[y * w + x]:
                q.append((x, y)); visited[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y) and not visited[y * w + x]:
                q.append((x, y)); visited[y * w + x] = 1
    while q:
        x, y = q.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny * w + nx] and is_bg(nx, ny):
                visited[ny * w + nx] = 1
                q.append((nx, ny))
    return img

def wipe_corner_mark(img: Image.Image) -> None:
    """擦除右下角 AI 水印（该区域 alpha 清零）"""
    px = img.load()
    w, h = img.size
    x0 = int(w * 0.68)
    y0 = int(h * 0.945)
    for y in range(y0, h):
        for x in range(x0, w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 0)

def trim(img: Image.Image, pad: int = 4) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad)
    r = min(img.width, r + pad); b = min(img.height, b + pad)
    return img.crop((l, t, r, b))

def resize_h(img: Image.Image, target_h: int) -> Image.Image:
    if img.height <= target_h:
        return img
    w = round(img.width * target_h / img.height)
    return img.resize((w, target_h), Image.LANCZOS)

def process_sprite(src: str, dst: str, target_h: int) -> None:
    img = Image.open(src)
    print(f"[in ] {os.path.basename(src)}: {info(img)}")
    if not has_real_alpha(img):
        print("      无有效 alpha → 白/棋盘底抠图")
        img = keyout_white(img)
    wipe_corner_mark(img)
    img = trim(img)
    img = resize_h(img, target_h)
    img.save(dst)
    print(f"[out] {os.path.basename(dst)}: {info(img)}")

def process_bg(src: str, dst: str, crop_bottom_pct: float) -> None:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    img = img.crop((0, 0, w, int(h * (1 - crop_bottom_pct))))
    img.save(dst, optimize=True)
    print(f"[out] {os.path.basename(dst)}: {info(img)}")

# 造景/人物/物品素材：前缀 → 输出名 + 目标高度
MAP: list[tuple[str, str, int]] = [
    ("Aquarium_plant_sprite__a_dense", "plant_green_round.png", 256),   # 亮绿圆叶丛
    ("Aquarium_plant_sprite__tall_re", "plant_red.png", 256),           # 红水草
    ("Aquarium_plant_sprite__long_ri", "plant_grass_strap.png", 256),   # 长带皇冠草
    ("Aquarium_driftwood", "wood_drift.png", 200),                      # 沉木
    ("Aquarium_rock_ornament", "rock_slate.png", 200),                  # 岩石堆
    ("Aquarium_decoration_sprite", "shell_conch.png", 120),             # 扇贝
    ("Aquarium_coral_ornament", "coral_branch.png", 180),               # 珊瑚
    ("Small_casual_game_character_sp_2026-09-30T13-34-46", "person_woman_red.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T13-35-19", "person_man_blue.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T13-35-11", "person_boy_yellow.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T13-35-10", "person_woman_green.png", 220),
    ("Game_item_icon_sprite__a_cylin", "item_food_can.png", 128),       # 鱼粮罐
    ("Game_item_icon_sprite__a_small_2026-09-30T13-35-45", "item_med_ick.png", 128),
    ("Game_item_icon_sprite__a_small_2026-09-30T13-35-47", "item_med_fungus.png", 128),
    ("Game_item_icon_sprite__a_small_2026-09-30T13-35-49", "item_vitamin.png", 128),
    ("Game_item_icon_sprite__a_small_2026-09-30T13-35-46", "item_egg_pouch.png", 128),
    ("Game_item_sprite__an_old_hardc", "item_research_book.png", 128),
]

# v6.1：鱼类多样化（体型/颜色）+ 尾型 + 人物多样性 + 渔网/木架素材
MAP2: list[tuple[str, str, int]] = [
    ("Game_sprite_asset__the_BODY_of_2026-09-30T14-13-18", "body_tetra_blue.png", 256),   # 细长银蓝
    ("Game_sprite_asset__the_BODY_of_2026-09-30T14-13-17", "body_angelfish_stripe.png", 256),  # 高身黄黑
    ("Game_sprite_asset__the_BODY_of_2026-09-30T14-13-19", "body_betta_red.png", 256),    # 大头红
    ("Game_sprite_asset__the_BODY_of_2026-09-30T14-13-22", "body_gar_green.png", 256),    # 尖长绿
    ("Game_sprite_asset__the_BODY_of_2026-09-30T14-13-58", "body_clownfish.png", 256),    # 小丑鱼
    ("Generate_ONLY_the_detached_TAI_2026-09-30T14-14-35", "tail_veiltail.png", 256),     # 长飘带尾
    ("Generate_ONLY_the_detached_TAI_2026-09-30T14-14-58", "tail_round_short.png", 256),  # 短圆尾
    ("Generate_ONLY_the_detached_TAI_2026-09-30T14-13-55", "tail_fan_large.png", 256),    # 大扇尾
    ("Small_casual_game_character_sp_2026-09-30T14-15-26", "person_glasses_man.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T14-15-27", "person_oldman_beard.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T14-15-29", "person_oldwoman.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T14-15-24", "person_girl_pink.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T14-16-00", "person_student_backpack.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T14-16-01", "person_businesswoman.png", 220),
    ("Small_casual_game_character_sp_2026-09-30T14-15-59", "person_cap_hoodie.png", 220),
    ("Small_ornament_sprite__a_tiny", "item_small_tank.png", 128),
    ("Game_item_icon_sprite__an_aqua", "item_thermometer.png", 128),
    ("Game_item_icon_sprite__a_small_2026-09-30T14-16-33", "item_fish_net.png", 128),
]

def process_net(src: str, dst: str) -> None:
    """渔网纹理：裁掉水印后输出 JPG（作为面板背景平铺）"""
    img = Image.open(src).convert("RGB")
    w, h = img.size
    img = img.crop((0, 0, w, int(h * 0.93)))
    img.save(dst, optimize=True, quality=88)
    print(f"[out] {os.path.basename(dst)}: {info(img)}")

if __name__ == "__main__":
    files = os.listdir(RAW)
    for prefix, out_name, th in MAP + MAP2:
        hit = [f for f in files if f.startswith(prefix)]
        if not hit:
            print(f"[skip] 未找到 {prefix}")
            continue
        process_sprite(os.path.join(RAW, hit[0]), os.path.join(OUT, out_name), th)
    net = [f for f in files if f.startswith("Game_UI_background_texture")]
    if net:
        process_net(os.path.join(RAW, net[0]), os.path.join(OUT, "net_bg.jpg"))
    print("done")
