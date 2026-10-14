"""Reproducible independent fixtures: ReportLab encoder + Poppler + Pillow.
Optional tooling, not required by npm test. Run from invent-front.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess, json
from reportlab.graphics.barcode import createBarcodeDrawing
from reportlab.graphics import renderPDF
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

out = Path('test/fixtures'); out.mkdir(parents=True, exist_ok=True)
examples = [('QR','qr','001234567890123','QRCode'),
 ('Code128','code128','001234567890123','Code128'),
 ('Standard39','code39','SN-001234','Code39'),
 ('Standard93','code93','SN-009321','Code93'),
 ('EAN13','ean13','7891234567895','EAN13'),
 ('EAN8','ean8','96385074','EAN8'),
 ('UPCA','upca','012345678905','UPCA'),
 ('I2of5','itf','00123456789014','ITF'),
 ('Codabar','codabar','A123456A','Codabar')]
manifest=[]
with TemporaryDirectory() as temp:
 for encoder, name, value, fmt in examples:
  kwargs = dict(value=value, humanReadable=False, checksum=0, barWidth=2, barHeight=100, quiet=True)
  if encoder=='QR': kwargs = dict(value=value, width=320, height=320)
  drawing=createBarcodeDrawing(encoder, **kwargs)
  pdf=Path(temp)/f'{name}.pdf'
  renderPDF.drawToFile(drawing,str(pdf))
  prefix=Path(temp)/name
  subprocess.run(['pdftoppm','-singlefile','-png','-scale-to','1400',str(pdf),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  image=Image.open(str(prefix)+'.png').convert('RGB')
  image=ImageOps.expand(image,border=80,fill='white')
  image.save(out/f'{name}.png')
  # EAN/UPC reader convention represents UPC-A as EAN13 with leading zero.
  expected='0'+value if encoder=='UPCA' else value
  manifest.append(dict(file=f'{name}.png',text=expected,format=fmt))
  if name in ['qr','code128','ean13']:
   variants={'rotated90':image.rotate(90,expand=True,fillcolor='white'),
    'tilted':image.rotate(13,expand=True,fillcolor='white'),
    'lowcontrast':ImageEnhance.Contrast(image).enhance(.35),
    'inverted':ImageOps.invert(image),
    'softfocus':image.filter(ImageFilter.GaussianBlur(.65))}
   for suffix, variant in variants.items():
    file=f'{name}-{suffix}.png'; variant.save(out/file)
    manifest.append(dict(file=file,text=expected,format=fmt))
 blank=Image.new('RGB',(640,480),'white'); blank.save(out/'blank.png')
 manifest.append(dict(file='blank.png',text=None))
 # Two independent codes in one label must be treated as ambiguous.
 qr=Image.open(out/'qr.png'); bar=Image.open(out/'code128.png')
 multiple=Image.new('RGB',(max(qr.width,bar.width),qr.height+bar.height+100),'white')
 multiple.paste(qr,(0,0)); multiple.paste(bar,(0,qr.height+100)); multiple.save(out/'multiple.png')
manifest.append(dict(file='multiple.png',text='001234567890123',format='multiple-same-value'))
qr=Image.open(out/'qr.png'); bar=Image.open(out/'code39.png')
multiple=Image.new('RGB',(max(qr.width,bar.width),qr.height+bar.height+100),'white')
multiple.paste(qr,(0,0)); multiple.paste(bar,(0,qr.height+100)); multiple.save(out/'multiple-distinct.png')
manifest.append(dict(file='multiple-distinct.png',texts=['001234567890123','SN-001234']))
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Generated', len(manifest),'fixtures')
