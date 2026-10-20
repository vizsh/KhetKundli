"use client";

/**
 * The kundli share card: the season wheel and a summary drawn on a canvas (1080 × 1350, the shape
 * WhatsApp and Instagram show whole), made on the phone and shared as an image. Nothing is uploaded.
 */

export type CardInfo = {
  name: string;
  nameMr: string;
  place: string;
  date: string;
  lines: { label: string; value: string }[];
  note: string;
};

const W = 1080, H = 1350;
const C = { board: "#cda868", paper: "#f4f5f0", ink: "#1c1a17", ink2: "#4a4640", ink3: "#7a756c", stamp: "#4a3aa8", rule: "#d9d6cc" };

/** Fonts inside an SVG drawn to a canvas cannot use the page's web fonts: map them to system faces. */
function systemFont(family: string) {
  if (/courier/i.test(family)) return "'Courier New', monospace";
  if (/deva|tiro|marathi/i.test(family)) return "'Nirmala UI', 'Mangal', sans-serif";
  return "'Segoe UI', Arial, sans-serif";
}

const PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "opacity", "fill-opacity", "stroke-opacity", "font-size", "font-weight", "letter-spacing", "paint-order", "text-anchor"];

/** Copies computed styles (with CSS variables resolved) onto a clone, so the SVG stands alone as an image. */
async function svgImage(svg: SVGSVGElement, size: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...svg.querySelectorAll("*")];
  const dst = [clone, ...clone.querySelectorAll("*")];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const out = dst[i] as SVGElement;
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v) out.style.setProperty(p, v);
    }
    if (el instanceof SVGTextElement || el instanceof SVGTSpanElement) out.style.setProperty("font-family", systemFont(cs.fontFamily));
  });
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function renderShareCard(svg: SVGSVGElement, info: CardInfo): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const body = getComputedStyle(document.body).fontFamily;
  const typed = getComputedStyle(document.querySelector(".typed") ?? document.body).fontFamily;
  const deva = "'Nirmala UI', 'Mangal', " + body;

  // Board, then the sheet of paper.
  ctx.fillStyle = C.board;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.paper;
  ctx.shadowColor = "rgba(40,30,10,0.28)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillRect(40, 40, W - 80, H - 80);
  ctx.shadowColor = "transparent";

  // Header.
  ctx.fillStyle = C.ink;
  ctx.font = `700 54px ${body}`;
  ctx.fillText(info.name, 84, 132);
  const nameW = ctx.measureText(info.name).width;
  ctx.fillStyle = C.ink2;
  ctx.font = `400 42px ${deva}`;
  ctx.fillText(info.nameMr, 84 + nameW + 22, 132);
  ctx.font = `400 26px ${typed}`;
  ctx.fillStyle = C.ink3;
  ctx.fillText(info.place, 84, 176);
  // Rubber date stamp, top right.
  ctx.save();
  ctx.translate(W - 190, 120);
  ctx.rotate(-0.07);
  ctx.strokeStyle = C.stamp;
  ctx.lineWidth = 4;
  ctx.strokeRect(-110, -38, 220, 70);
  ctx.fillStyle = C.stamp;
  ctx.font = `700 32px ${typed}`;
  ctx.textAlign = "center";
  ctx.fillText(info.date, 0, 9);
  ctx.restore();
  ctx.fillStyle = C.ink;
  ctx.fillRect(84, 204, W - 168, 3);

  // The wheel.
  const img = await svgImage(svg, 700);
  ctx.drawImage(img, (W - 700) / 2, 220, 700, 700);

  // Summary: two columns of ruled lines.
  ctx.fillStyle = C.ink;
  ctx.fillRect(84, 934, W - 168, 3);
  const colW = (W - 168) / 2;
  info.lines.slice(0, 6).forEach((l, i) => {
    const x = 84 + (i % 2) * colW + (i % 2 ? 24 : 0), y = 982 + Math.floor(i / 2) * 80;
    ctx.fillStyle = C.ink3;
    ctx.font = `600 20px ${body}`;
    ctx.fillText(l.label.toUpperCase(), x, y);
    ctx.fillStyle = C.ink;
    ctx.font = `400 28px ${typed}`;
    ctx.fillText(l.value, x, y + 36, colW - 30);
    ctx.fillStyle = C.rule;
    ctx.fillRect(x, y + 52, colW - 30, 2);
  });

  // Footer: the name and its promise, then what this card is.
  ctx.fillStyle = C.ink;
  ctx.fillRect(84, 1214, W - 168, 3);
  ctx.font = `700 30px ${body}`;
  ctx.fillText("KhetKundli", 84, 1262);
  const kw = ctx.measureText("KhetKundli").width;
  ctx.font = `400 27px ${deva}`;
  ctx.fillStyle = C.ink2;
  ctx.fillText("खेतकुंडली · प्रत्येक शेत लक्षात ठेवते", 84 + kw + 16, 1262);
  ctx.font = `400 18px ${typed}`;
  ctx.fillStyle = C.ink3;
  ctx.fillText(info.note, 84, 1290);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png"));
}
