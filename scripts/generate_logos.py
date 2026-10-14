import base64

with open('public/jangora-symbol-gold.png', 'rb') as f:
    gold_b64 = base64.b64encode(f.read()).decode('utf-8')

with open('public/jangora-symbol-green.png', 'rb') as f:
    green_b64 = base64.b64encode(f.read()).decode('utf-8')

svg_day = f"""<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="512" height="512" rx="115" fill="#F7F5EF"/>
  <rect width="510" height="510" x="1" y="1" rx="114" stroke="#DDE6DF" stroke-width="2"/>
  <image href="data:image/png;base64,{green_b64}" x="76" y="90" width="360" height="332" preserveAspectRatio="xMidYMid meet"/>
</svg>"""

with open('public/logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_day)

svg_dark = f"""<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="512" height="512" rx="115" fill="#0D2928"/>
  <rect width="510" height="510" x="1" y="1" rx="114" stroke="#2B514B" stroke-width="2"/>
  <image href="data:image/png;base64,{gold_b64}" x="76" y="90" width="360" height="332" preserveAspectRatio="xMidYMid meet"/>
</svg>"""

with open('public/logo-dark.svg', 'w', encoding='utf-8') as f:
    f.write(svg_dark)

print("Generated public/logo.svg and public/logo-dark.svg successfully!")
