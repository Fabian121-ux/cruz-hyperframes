"""Extract the original pose and separate its pointing arm.
No generated character art or optical-flow intermediates are introduced.
"""
import json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw

cfg = json.loads(Path("quote.config.json").read_text())
if cfg["source"] != "Quote.mp4":
    raise RuntimeError("This edit must use only Quote.mp4")
Path("quote-assets").mkdir(exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i",
                "Quote.mp4", "-vf", f'select=eq(n\\,{cfg["poseFrame"]})',
                "-frames:v", "1", "quote-assets/pose.png"], check=True)
pose = Image.open("quote-assets/pose.png").convert("RGB")
if pose.size != (1920, 1080):
    raise RuntimeError(f"Unexpected source dimensions: {pose.size}")
# Quotation begins at x=956; the pointing fingertip ends at x=935.
sprite = pose.crop((0, 0, 948, 1080))
body = sprite.copy()
draw = ImageDraw.Draw(body)
# Erase the old smear above the true arm and the arm now in its own layer.
draw.polygon([(481, 310), (859, 310), (859, 374), (410, 374),
              (410, 354), (470, 337)], fill=(0, 0, 0))
draw.rectangle((445, 374, 947, 468), fill=(0, 0, 0))
joint = sprite.getpixel((470, 405))
draw.ellipse((405, 380, 449, 424), fill=joint)
body.save("quote-assets/character-body.png")
mask = Image.new("L", sprite.size, 0)
ImageDraw.Draw(mask).polygon([
    (410, 377), (785, 377), (795, 370), (939, 359), (944, 405),
    (885, 449), (786, 449), (780, 434), (409, 435)
], fill=255)
arm = sprite.convert("RGBA")
arm.putalpha(mask)
arm.save("quote-assets/pointing-arm.png")
print("Prepared original body and one pointing arm; source text excluded.")
