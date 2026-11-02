// Maximize the smaller side of every key within the space left by the controls.
// ResizeObserver also follows dvh changes when mobile browser bars open/close.
export function fitKeyboard(keyboard: HTMLElement): void {
  function fit() {
    const { width, height } = keyboard.getBoundingClientRect();
    if (!width || !height) return;
    const large = document.documentElement.dataset.size === 'large';
    const gap = width < 400 || height < 230 ? 4 : 8;
    let best = { columns: 5, side: 0, squareness: Infinity };
    for (let columns = 4; columns <= 11; columns++) {
      const rows = Math.ceil(33 / columns);
      const keyWidth = (width - gap * (columns - 1)) / columns;
      const keyHeight = (height - gap * (rows - 1)) / rows;
      const side = Math.min(keyWidth, keyHeight);
      const squareness = Math.abs(keyWidth - keyHeight);
      if (side > best.side + 0.5 || (Math.abs(side - best.side) <= 0.5 && squareness < best.squareness)) {
        best = { columns, side, squareness };
      }
    }
    keyboard.style.setProperty('--columns', String(best.columns));
    keyboard.style.setProperty('--key-gap', `${gap}px`);
    keyboard.style.setProperty('--key-font', `${Math.max(22, Math.min(large ? 48 : 40, best.side * (large ? 0.7 : 0.57)))}px`);
  }
  new ResizeObserver(fit).observe(keyboard);
  new MutationObserver(fit).observe(document.documentElement, { attributes: true, attributeFilter: ['data-size'] });
  fit();
}
