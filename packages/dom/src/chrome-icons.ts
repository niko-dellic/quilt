/** Shared geometry for renderer-owned controls, independent of application icons. */
export function chromeIcon(doc: Document, name: 'close' | 'more' | 'dot'): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.classList.add('layouts-chrome-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (name === 'close') {
    const path = doc.createElementNS(ns, 'path');
    path.setAttribute('d', 'M6 6 18 18 M18 6 6 18');
    svg.append(path);
  } else {
    for (const y of name === 'dot' ? [12] : [5, 12, 19]) {
      const dot = doc.createElementNS(ns, 'circle');
      dot.setAttribute('cx', '12');
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', name === 'dot' ? '2.5' : '1');
      if (name === 'dot') dot.setAttribute('fill', 'currentColor');
      svg.append(dot);
    }
  }
  return svg;
}
