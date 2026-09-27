/** The shareable "Rondo No. 0427" card, drawn for Founders after they have paid their deposit. */
const pad = (n: number) => String(n).padStart(4, '0');

export function drawFoundersCard(canvas: HTMLCanvasElement, n: number): HTMLCanvasElement {
  const x = canvas.getContext('2d')!;
  const S = canvas.width;
  x.fillStyle = '#040b1a';
  x.fillRect(0, 0, S, S);
  const grad = x.createRadialGradient(S * 0.5, S * 0.42, 10, S * 0.5, S * 0.42, S * 0.6);
  grad.addColorStop(0, 'rgba(214,168,74,0.35)');
  grad.addColorStop(1, 'rgba(214,168,74,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);
  x.save();
  x.translate(S / 2, S * 0.4);
  [300, 240, 180, 120].forEach((r, i) => {
    x.strokeStyle = `rgba(208,224,242,${0.18 + i * 0.06})`;
    x.lineWidth = 26;
    x.beginPath();
    x.arc(0, 0, r, 0, Math.PI * 2);
    x.stroke();
  });
  x.fillStyle = '#d6a84a';
  x.beginPath();
  x.arc(0, 0, 62, 0, Math.PI * 2);
  x.fill();
  x.restore();
  x.fillStyle = '#e9f0f8';
  x.textAlign = 'center';
  x.font = '800 150px Archivo, Arial, sans-serif';
  x.fillText(`No. ${pad(n)}`, S / 2, S * 0.83);
  x.font = '600 34px Archivo, Arial, sans-serif';
  x.fillStyle = '#9eb4ca';
  x.fillText('RONDO FOUNDERS EDITION · 1 OF 2,000', S / 2, S * 0.9);
  return canvas;
}
