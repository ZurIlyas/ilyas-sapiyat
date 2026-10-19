# Убирает девушку с компьютером (зеркальная копия кустов из того же кадра, Пуассоновская склейка)
# и ставит на склон жениха и невесту со спины. Пишет H.264 mp4 и постер.
import subprocess, sys
import cv2, numpy as np
import imageio_ffmpeg
from PIL import Image, ImageFilter

FF = imageio_ffmpeg.get_ffmpeg_exe()
WITH_COUPLE = '--couple' in sys.argv   # пару убрали по просьбе; вернуть: python make_video.py --couple
mask = np.load('mask.npy')
br = cv2.boundingRect(mask)
center = (br[0] + br[2] // 2, br[1] + br[3] // 2)

# пара: ноги на y=FEET, по центру X=CX, рост H пикселей
CX, FEET, H = 410, 444, 172
couple = Image.open('couple.png').convert('RGBA')          # 520×720, земля на 352/360 высоты
scale = H / (720 * 352 / 360)
cw, ch = round(couple.width * scale), round(couple.height * scale)
couple = couple.resize((cw, ch), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.45))
ox, oy = CX - cw // 2, FEET - round(ch * 352 / 360)
c = np.asarray(couple).astype(np.float32) / 255
rgb, alpha = c[..., :3][..., ::-1], c[..., 3:4]            # в BGR

def grade(rgb, night):
    if night:   # лунный свет: темно, холодно, светлее правый край
        lum = rgb.mean(-1, keepdims=True)
        g = (rgb * 0.35 + lum * 0.65) * np.array([0.50, 0.36, 0.27])   # приглушённо, в синеву
        g = g * 0.78 + np.array([0.06, 0.04, 0.025])
    else:       # тёплый вечерний свет и лёгкая дымка, как у травы вокруг
        g = rgb * np.array([0.92, 0.97, 1.04]) * 0.97
        g = g * 0.9 + np.array([0.06, 0.08, 0.09])
    return np.clip(g, 0, 1)

def process(name, night):
    cap = cv2.VideoCapture(name + '.mp4')
    fps = cap.get(5)
    out = name + '_wed.mp4'
    p = subprocess.Popen([FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1280x720', '-r', str(fps), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], stdin=subprocess.PIPE)
    col = grade(rgb, night)
    i = 0
    while True:
        ok, f = cap.read()
        if not ok: break
        src = f.copy()
        src[340:700, 378:778] = f[340:700, 0:400][:, ::-1]
        f = cv2.seamlessClone(src, f, mask.copy(), center, cv2.NORMAL_CLONE)   # копия: OpenCV портит маску при повторных вызовах
        if WITH_COUPLE:
            reg = f[oy:oy + ch, ox:ox + cw].astype(np.float32) / 255
            grain = np.random.normal(0, 0.018, col.shape).astype(np.float32)
            reg = reg * (1 - alpha) + np.clip(col + grain, 0, 1) * alpha
            f[oy:oy + ch, ox:ox + cw] = (reg * 255).astype(np.uint8)
        if i == 0: cv2.imencode('.jpg', f, [cv2.IMWRITE_JPEG_QUALITY, 86])[1].tofile(name + '_poster.jpg')
        p.stdin.write(f.tobytes())
        i += 1
    p.stdin.close(); p.wait()
    print(name, i, 'кадров')

for n, night in (('day', False), ('night', True)):
    process(n, night)
