"""Rebuild the four one-cell separators. Requires fonttools and brotli."""
import base64
import re
from io import BytesIO
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen


def polygon(points):
    pen = TTGlyphPen(None)
    if points:
        pen.moveTo(points[0])
        for point in points[1:]:
            pen.lineTo(point)
        pen.closePath()
    return pen.glyph()


# Coordinates are in a 500-unit-wide monospace cell with a 1000-unit em.
solid = [(0, 800), (500, 300), (0, -200)]
thin = [(0, 800), (500, 300), (0, -200), (0, -120), (420, 300), (0, 720)]
shapes = [solid, thin, [(500-x, y) for x, y in solid], [(500-x, y) for x, y in thin]]
glyphs = {'.notdef': polygon([])}
mapping = {}
for i, shape in enumerate(shapes):
    code = 0xE0B0 + i
    name = f'uni{code:04X}'
    glyphs[name] = polygon(shape)
    mapping[code] = name

font = FontBuilder(1000, isTTF=True)
font.setupGlyphOrder(list(glyphs))
font.setupCharacterMap(mapping)
font.setupGlyf(glyphs)
font.setupHorizontalMetrics({k: (500, 0) for k in glyphs})
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({'familyName': 'DSH Prompt Separators', 'styleName': 'Regular',
                     'psName': 'DSHPromptSeparators-Regular', 'fullName': 'DSH Prompt Separators Regular'})
font.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
font.setupPost(isFixedPitch=1)
font.font['head'].created = font.font['head'].modified = 3800000000
font.font.recalcTimestamp = False
font.font.flavor = 'woff2'
buffer = BytesIO()
font.save(buffer)
url = 'data:font/woff2;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')
client = Path(__file__).resolve().parents[1] / 'client.js'
previous = client.read_text()
source, count = re.subn(r'data:font/woff2;base64,[A-Za-z0-9+/=]+', url, previous)
if count != 1:
    raise ValueError('Expected one embedded separator font in client.js')
if source != previous:
    client.write_text(source)
