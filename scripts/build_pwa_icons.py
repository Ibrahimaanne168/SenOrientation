import os
import shutil
from PIL import Image, ImageOps, ImageDraw
import numpy as np

src_path = r'C:\Users\annei\.gemini\antigravity-ide\brain\acdb9d35-84f3-4d8f-bf1f-c4a2f8e5e0ff\.user_uploaded\media_1791987997412.jpg'
raw_img = Image.open(src_path).convert('RGB')

# 1. Save master copy
raw_img.save('public/jangora-master-icon.jpg', quality=95)

# 2. Create transparent version
# Background is nearly white (>= 248)
arr = np.array(raw_img.convert('RGBA'))
# Color distance from pure white [255, 255, 255]
diff = 255 - arr[:, :, :3]
max_diff = np.max(diff, axis=-1)
# Create smooth alpha channel
alpha = np.clip(max_diff * 6, 0, 255).astype(np.uint8)
arr[:, :, 3] = alpha
transparent_tree = Image.fromarray(arr)
transparent_tree.save('public/jangora-tree-hd.png')
print("Saved public/jangora-tree-hd.png")

# 3. Create PWA and App icon (512x512) with safe-area padding
# Using clean white background with rounded squircle or solid square for maskable
def create_pwa_icon(size, transparent_sym, bg_color=(255, 255, 255, 255), padding_ratio=0.10):
    canvas = Image.new('RGBA', (size, size), bg_color)
    
    # Scale symbol to fit safe area
    target_w = int(size * (1 - 2 * padding_ratio))
    target_h = int(size * (1 - 2 * padding_ratio))
    scale = min(target_w / transparent_sym.width, target_h / transparent_sym.height)
    new_w = int(transparent_sym.width * scale)
    new_h = int(transparent_sym.height * scale)
    
    resized_sym = transparent_sym.resize((new_w, new_h), Image.Resampling.LANCZOS)
    pos_x = (size - new_w) // 2
    pos_y = (size - new_h) // 2
    canvas.paste(resized_sym, (pos_x, pos_y), resized_sym)
    return canvas

icon_512 = create_pwa_icon(512, transparent_tree, (255, 255, 255, 255), padding_ratio=0.10)
icon_512.save('public/icon.png')
icon_512.save('public/logo.png')
icon_512.save('app/icon.png')
print("Saved 512x512 icon.png")

icon_192 = create_pwa_icon(192, transparent_tree, (255, 255, 255, 255), padding_ratio=0.10)
icon_192.save('public/icon-192.png')
print("Saved 192x192 icon-192.png")

# 4. Apple Touch Icon (180x180)
apple_180 = create_pwa_icon(180, transparent_tree, (255, 255, 255, 255), padding_ratio=0.10)
apple_180.save('public/apple-icon.png')
apple_180.save('app/apple-icon.png')
print("Saved 180x180 apple-icon.png")

# 5. Multi-size Favicon.ico
favicon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
favicon_images = []
for s in favicon_sizes:
    fav_im = create_pwa_icon(s[0], transparent_tree, (255, 255, 255, 255), padding_ratio=0.06)
    favicon_images.append(fav_im)

favicon_images[0].save(
    'public/favicon.ico',
    format='ICO',
    sizes=favicon_sizes,
    append_images=favicon_images[1:]
)
shutil.copy('public/favicon.ico', 'app/favicon.ico')
print("Saved public/favicon.ico and app/favicon.ico with multiple sizes!")
