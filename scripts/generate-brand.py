from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]/'public/brand'; root.mkdir(exist_ok=True)
from PIL import ImageFont
units=1000
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',1000)
x=font.getlength('Forma.') - 25*5
word='<text x="0" y="0" transform="scale(1 -1)" font-family="Arial, Helvetica, sans-serif" font-size="1000" letter-spacing="-25" text-anchor="middle">Forma.</text>'
marks={
'signal':lambda ink,accent:f'<path d="M3 16h6M23 4l-3 5M23 28l-3-5" stroke="{ink}" stroke-width="2" stroke-linecap="round"/><path d="M7 7a13 13 0 0 0 0 18M13 3a13 13 0 0 1 15 9M28 20a13 13 0 0 1-15 9" stroke="{ink}" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="16" r="3.5" fill="{accent}"/>'}

palettes={'mono-dark':('#202020','#202020'), 'mono-light':('#f2f2f2','#f2f2f2'), 'color-dark':('#202020','#a65e35'), 'color-light':('#f2f2f2','#dca77d')}
manifest=[]
for family,mark in marks.items():
 for layout in ['mark','horizontal','stacked']:
  for palette,(ink,accent) in palettes.items():
   for background in ['transparent','solid']:
    light=palette.endswith('light'); bg='#191919' if light else '#f4f2ed'
    w,h={'mark':(512,512),'horizontal':(1600,480),'stacked':(1000,1000)}[layout]
    if layout=='mark': content=f'<g transform="translate(64 64) scale(12)">{mark(ink,accent)}</g>'
    elif layout=='horizontal':content=f'<g transform="translate(90 80) scale(10)">{mark(ink,accent)}</g><g fill="{ink}" transform="translate(1010 320) scale({250/units} {-250/units})">{word}</g>'
    else:content=f'<g transform="translate(276 100) scale(14)">{mark(ink,accent)}</g><g fill="{ink}" transform="translate(500 820) scale({190/units} {-190/units})">{word}</g>'
    name=f'forma-{family}-{layout}-{palette}-{background}'
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none"><title>Forma {family} {layout}</title>'+ (f'<rect width="{w}" height="{h}" fill="{bg}"/>' if background=='solid' else '')+content+'</svg>'
    (root/f'{name}.svg').write_text(svg)
    manifest.append(dict(name=name,family=family,layout=layout,palette=palette,background=background,width=w,height=h,solidColor=bg))
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
