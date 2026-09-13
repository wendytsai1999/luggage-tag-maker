const tagEl = document.getElementById('tag');
const canvas = document.getElementById('exportCanvas');
const ctx = canvas.getContext('2d');

const fTo = document.getElementById('f_to');
const fMessage = document.getElementById('f_message');
const iconImg = document.getElementById('iconImg');
const routeBtns = document.querySelectorAll('.route-btn');
const visitTimeEl = document.getElementById('visitTime');
const barcodeEl = document.getElementById('barcode');

let currentRoute = '';

// theme per route: gradient stops (used for both live CSS and canvas export).
// icon images live in images-data.js as base64 (see that file for why) —
// swapping an icon means regenerating that file, not just replacing a .png
const THEMES = {
  '': {
    stops: ['#5b6472', '#333a45', '#1b1f27'],
    image: null
  },
  '佛': {
    stops: ['#D9A43C', '#B8791F', '#6E3A0F'],
    image: THEME_IMAGES['佛']
  },
  '道': {
    stops: ['#3B4CB0', '#4A3590', '#1E1740'],
    image: THEME_IMAGES['道']
  },
  '來義鄉排灣族': {
    stops: ['#A85A2E', '#7A3016', '#3D1608'],
    image: THEME_IMAGES['來義鄉排灣族']
  }
};

// preload the three ritual images so canvas export doesn't have to wait
const themeImages = {};
Object.keys(THEMES).forEach(route => {
  const src = THEMES[route].image;
  if (!src) return;
  const img = new Image();
  img.src = src;
  themeImages[route] = img;
});

function cssGradient(stops) {
  return `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`;
}

function applyTheme(route) {
  currentRoute = route;
  const t = THEMES[route] || THEMES[''];
  tagEl.style.background = cssGradient(t.stops);
  iconImg.src = t.image || '';
  iconImg.style.display = t.image ? 'block' : 'none';

  routeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
}

routeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // clicking the already-selected route deselects it back to the neutral style
    applyTheme(currentRoute === btn.dataset.route ? '' : btn.dataset.route);
  });
});

applyTheme('');

// require a route/theme to be chosen before the tag's fields can be filled in
function guardRouteChosen(e) {
  if (!currentRoute) {
    e.preventDefault();
    e.target.blur();
    alert('請先選擇上方的樣式（佛教／道教／來義鄉排灣族），再填寫掛牌內容');
  }
}
[fTo, fMessage].forEach(el => {
  el.addEventListener('mousedown', guardRouteChosen);
  el.addEventListener('focus', guardRouteChosen);
});

// shrink the textarea to fit its own content (instead of filling the whole
// box), so align-items:center on .msg-box actually centers the text
// vertically — a plain <textarea> always starts its text at the top
const MSG_BOX_MAX_HEIGHT = 84; // px, box height (112) minus its padding
function autosizeMessage() {
  fMessage.style.height = 'auto';
  fMessage.style.height = Math.min(fMessage.scrollHeight, MSG_BOX_MAX_HEIGHT) + 'px';
}
fMessage.addEventListener('input', autosizeMessage);
autosizeMessage();

function formatVisitTime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateVisitTime() {
  visitTimeEl.textContent = formatVisitTime(new Date());
}
updateVisitTime();
setInterval(updateVisitTime, 30000);

// generate a realistic-looking barcode pattern once, reused by both the
// live page and the canvas export so they always match
const BARCODE_BAR_COUNT = 46;
const barcodePattern = Array.from({ length: BARCODE_BAR_COUNT }, () => 1 + Math.floor(Math.random() * 4));

function renderBarcode() {
  barcodeEl.innerHTML = '';
  barcodePattern.forEach(w => {
    const span = document.createElement('span');
    span.style.width = w + 'px';
    barcodeEl.appendChild(span);
  });
}
renderBarcode();

// ---- canvas export ---------------------------------------------------
// Draws the same tag shown on screen onto a hidden canvas at 2x resolution,
// so "製作" can save it as a PNG. Every measurement below is a CSS-pixel
// value multiplied by `scale` — keep it that way if you resize anything in
// style.css, and mirror the change here too.

function drawTagToCanvas() {
  const scale = 2;
  // the tag's own size in canvas px — tuned to look right, not derived from
  // .tag's aspect-ratio in style.css, so it won't match that exactly if you
  // change the CSS width/aspect-ratio without also updating this
  const W = 1320, H = 712;
  const MARGIN_L = 220; // extra canvas width so the cord (which sags out
                         // past the tag's left edge) doesn't get clipped
  const t = THEMES[currentRoute] || THEMES[''];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(MARGIN_L, 0);

  const STUB_W = 78; // css px; the left "ticket stub" strip

  drawTagBackground(t);
  drawStubAndCord(STUB_W, scale);

  const bodyX = STUB_W * scale + 28 * scale;
  const bodyR = W - 52 * scale;
  const bodyW = bodyR - bodyX;

  const pill = drawNameAndVisitTime(bodyX, bodyR, bodyW, scale);
  drawMessageBox(bodyX, bodyR, bodyW, pill, scale);
  drawBarcodeAndTagline(bodyX, bodyR, scale);

  function drawTagBackground(theme) {
    roundRect(0, 0, W, H, 26 * scale);
    ctx.save();
    ctx.clip();
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, theme.stops[0]);
    grad.addColorStop(0.55, theme.stops[1]);
    grad.addColorStop(1, theme.stops[2]);
    ctx.fillStyle = grad;
    ctx.fill();
    drawPaperTexture(0, 0, W, H);
    ctx.restore();

    roundRect(0, 0, W, H, 26 * scale);
    ctx.setLineDash([5 * scale, 7 * scale]);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3 * scale;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawStubAndCord(stubWCss, scale) {
    const stubW = stubWCss * scale;
    ctx.beginPath();
    ctx.setLineDash([5 * scale, 7 * scale]);
    ctx.moveTo(stubW, 0);
    ctx.lineTo(stubW, H);
    ctx.stroke();
    ctx.setLineDash([]);

    const holeX = stubW / 2, holeY = H / 2;
    ctx.beginPath();
    ctx.arc(holeX, holeY, 13 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();

    // cord threaded through the punch hole, sagging out past the tag's
    // left edge into MARGIN_L (mirrors the CSS <svg> path in index3.html)
    ctx.beginPath();
    ctx.moveTo(holeX, holeY + 4 * scale);
    ctx.bezierCurveTo(holeX - 26 * scale, holeY + 40 * scale, holeX - 76 * scale, holeY + 34 * scale, holeX - 120 * scale, holeY + 72 * scale);
    ctx.strokeStyle = '#cbb27a';
    ctx.lineWidth = 4.5 * scale;
    ctx.lineCap = 'round';
    ctx.stroke();

    // frayed tip
    const tipX = holeX - 120 * scale, tipY = holeY + 72 * scale;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - 10 * scale, tipY - 6 * scale);
    ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - 6 * scale, tipY + 10 * scale);
    ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + 4 * scale, tipY + 12 * scale);
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.beginPath();
    ctx.arc(holeX, holeY, 4.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#cbb27a';
    ctx.fill();
  }

  function drawNameAndVisitTime(bodyX, bodyR, bodyW, scale) {
    const pillH = 56 * scale;
    const pillY = 20 * scale;
    const pillW = bodyW * 0.62;
    roundRect(bodyX, pillY, pillW, pillH, pillH / 2);
    ctx.setLineDash([5 * scale, 7 * scale]);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#fff';
    ctx.font = `700 ${16 * scale}px "Noto Sans TC", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(fTo.value || '請輸入名稱', bodyX + 24 * scale, pillY + pillH / 2);

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.fillText('觀展時間', bodyR, pillY + 20 * scale);
    ctx.fillText(visitTimeEl.textContent, bodyR, pillY + 42 * scale);
    ctx.textAlign = 'left';

    return { y: pillY, h: pillH };
  }

  function drawMessageBox(bodyX, bodyR, bodyW, pill, scale) {
    // fixed height, vertically centered in the leftover space below the
    // name/visit-time row — matches .msg-wrap + .msg-box in style.css
    const availTop = pill.y + pill.h + 14 * scale;
    const availBottom = H - 90 * scale;
    const boxH = 112 * scale;
    const boxY = availTop + (availBottom - availTop - boxH) / 2;
    roundRect(bodyX, boxY, bodyW, boxH, 12 * scale);
    ctx.setLineDash([5 * scale, 7 * scale]);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2.5 * scale;
    ctx.stroke();
    ctx.setLineDash([]);

    // ritual icon, right-aligned and vertically centered inside the box
    // (matches the on-screen flex layout: text on the left, icon on the right)
    const boxPad = 18 * scale;
    const iconGap = 14 * scale;
    const iconSize = boxH - 28 * scale; // source art is a square PNG
    const iconX = bodyR - boxPad - iconSize;
    const iconY = boxY + (boxH - iconSize) / 2;
    const img = themeImages[currentRoute];
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.filter = 'invert(1)'; // matches the CSS invert() on the on-screen icon
      ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
      ctx.restore();
    }

    // message text: wrapped, then vertically centered as a block within
    // the box (matches the on-screen textarea, which shrinks to fit content)
    const textMaxWidth = (img ? iconX - iconGap : bodyR - boxPad) - (bodyX + boxPad);
    const lineHeight = 24 * scale;
    ctx.font = `700 ${16 * scale}px "Noto Sans TC", sans-serif`;
    const lines = getWrappedLines(fMessage.value || '請寫下對自己的生命旅程的期許', textMaxWidth, 4);
    const textBlockH = lines.length * lineHeight;
    const firstBaselineY = boxY + (boxH - textBlockH) / 2 + lineHeight * 0.8;
    ctx.fillStyle = '#fff';
    lines.forEach((ln, i) => ctx.fillText(ln, bodyX + boxPad, firstBaselineY + i * lineHeight));
  }

  function drawBarcodeAndTagline(bodyX, bodyR, scale) {
    const barH = 26 * scale;
    const barBottom = H - 20 * scale;
    const barGap = 1.5 * scale;
    let barX = bodyX;
    ctx.fillStyle = '#fff';
    barcodePattern.forEach(w => {
      const bw = w * scale;
      ctx.fillRect(barX, barBottom - barH, bw, barH);
      barX += bw + barGap;
    });

    ctx.textAlign = 'right';
    ctx.font = `700 ${16 * scale}px "Noto Sans TC", sans-serif`;
    ctx.fillText('✈ 終章未完，再次啟航 ✈', bodyR, barBottom - barH / 2 + 4 * scale);
    ctx.textAlign = 'left';
  }

  function drawPaperTexture(x, y, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    const speckles = Math.floor((w * h) / 900);
    for (let i = 0; i < speckles; i++) {
      const sx = x + Math.random() * w;
      const sy = y + Math.random() * h;
      const shade = Math.random() < 0.5 ? '255,255,255' : '0,0,0';
      ctx.fillStyle = `rgba(${shade},${(0.05 + Math.random() * 0.18).toFixed(2)})`;
      ctx.fillRect(sx, sy, scale, scale);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function getWrappedLines(text, maxWidth, maxLines) {
    const chars = text.split('');
    const lines = [];
    let line = '';
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line !== '') {
        if (lines.length >= maxLines - 1) {
          // last allowed line: fit as much of the remainder as possible
          let rest = line + chars.slice(i).join('');
          if (ctx.measureText(rest).width > maxWidth) {
            while (rest.length && ctx.measureText(rest + '…').width > maxWidth) {
              rest = rest.slice(0, -1);
            }
            rest += '…';
          }
          lines.push(rest);
          return lines;
        }
        lines.push(line);
        line = chars[i];
      } else {
        line = test;
      }
    }
    lines.push(line);
    return lines;
  }
}

document.getElementById('makeBtn').addEventListener('click', () => {
  try {
    drawTagToCanvas();
    canvas.toBlob((blob) => {
      if (!blob) {
        alert('圖片產生失敗，請重新整理頁面後再試一次');
        return;
      }
      const filename = `luggage-tag-${(fTo.value || 'my').trim() || 'my'}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (err) {
    alert('產生掛牌圖片時發生錯誤：' + err.message);
  }
});
