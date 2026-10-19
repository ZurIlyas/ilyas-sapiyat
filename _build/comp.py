import cv2, numpy as np
rng = np.random.default_rng(3)
X0, X1, Y0, Y1 = 378, 778, 340, 700
def blob_mask(shape):
    m = np.zeros(shape, np.uint8)
    # неровная «шапка» кустов сверху и мягкие бока
    cv2.rectangle(m, (390, 395), (768, 700), 255, -1)
    for cx in range(395, 770, 26):
        r = int(rng.integers(26, 42)); cy = 392 + int(rng.integers(-18, 14)) - (12 if 440 < cx < 530 else 0)
        cv2.circle(m, (cx, cy), r, 255, -1)
    return m
def clean(name, m):
    f = cv2.imdecode(np.fromfile(name + '.png', np.uint8), 1)
    src = f.copy()
    w = X1 - X0
    src[Y0:Y1, X0:X1] = f[Y0:Y1, 0:w][:, ::-1]
    br = cv2.boundingRect(m)
    center = (br[0] + br[2] // 2, br[1] + br[3] // 2)
    return cv2.seamlessClone(src, f, m, center, cv2.NORMAL_CLONE)
m = None
for n in ('day0', 'night0'):
    f = cv2.imdecode(np.fromfile(n + '.png', np.uint8), 1)
    if m is None: m = blob_mask(f.shape[:2]); m[700:] = 0
    o = clean(n, m)
    cv2.imencode('.png', o)[1].tofile(n + '_bush.png')
np.save('mask.npy', m)
a = cv2.imdecode(np.fromfile('day0_bush.png', np.uint8), 1)
b = cv2.imdecode(np.fromfile('night0_bush.png', np.uint8), 1)
cv2.imencode('.jpg', np.hstack([cv2.resize(a[200:720, 200:1000], (640, 416)), cv2.resize(b[200:720, 200:1000], (640, 416))]))[1].tofile('bush_view.jpg')
