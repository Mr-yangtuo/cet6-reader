const $ = selector => document.querySelector(selector);
const viewport = $('#viewport');
const pagesContainer = $('#pdf-pages');
let pdf, item, zoom = 1, ready = false, generation = 0;
let pages = [], rendering = false, renderTask, scrollFrame, saveTimer, resizeTimer;
let layoutWidth = 0;

function savedPosition(id) {
  try { return JSON.parse(localStorage.getItem(`cet6:${id}`)) || {}; } catch { return {}; }
}
function pageTop(entry) { return entry.element.offsetTop + pagesContainer.offsetTop; }
function readingPosition() {
  const top = viewport.scrollTop;
  let entry = pages[0];
  for (const candidate of pages) {
    if (pageTop(candidate) > top + 2) break;
    entry = candidate;
  }
  if (top > 0 && top >= viewport.scrollHeight - viewport.clientHeight - 2) entry = pages.at(-1);
  return { page: entry.number, offset: Math.min(1, Math.max(0, (top - pageTop(entry)) / entry.height)) };
}
function saveProgress() {
  if (!ready) return;
  try {
    const data = { id: item.id, ...readingPosition() };
    localStorage.setItem(`cet6:${item.id}`, JSON.stringify(data));
    localStorage.setItem('cet6:last', JSON.stringify(data));
  } catch { /* Reading remains available when browser storage is disabled. */ }
}
function updateControls() {
  $('#zoom-out').disabled = !ready || zoom <= 1;
  $('#zoom-in').disabled = !ready || zoom >= 3;
  $('#fit').disabled = !ready;
  $('#fit').textContent = zoom === 1 ? '适宽' : `${Math.round(zoom * 100)}%`;
  if (ready) $('#current-page').textContent = readingPosition().page;
}
function errorState(message) {
  const status = $('#status'); status.replaceChildren(); status.hidden = false;
  const text = document.createElement('span'); text.textContent = message;
  const actions = document.createElement('div'); actions.className = 'error-actions';
  const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.addEventListener('click', () => location.reload()); actions.append(retry);
  if (item) { const direct = document.createElement('a'); direct.href = item.file; direct.textContent = '直接打开 PDF'; actions.append(direct); }
  const back = document.createElement('a'); back.href = './'; back.textContent = '返回书架'; actions.append(back);
  status.append(text, actions);
}
function releaseCanvas(entry) {
  if (!entry.canvas) return;
  entry.canvas.remove();
  entry.canvas.width = entry.canvas.height = 0;
  entry.canvas = null;
  entry.placeholder.hidden = false;
}
function nearViewport(entry, margin = 1) {
  const top = pageTop(entry);
  return top + entry.height >= viewport.scrollTop - viewport.clientHeight * margin &&
    top <= viewport.scrollTop + viewport.clientHeight * (1 + margin);
}
async function renderNearbyPages() {
  if (rendering || !ready) return;
  rendering = true;
  try {
    while (ready) {
      const center = viewport.scrollTop + viewport.clientHeight / 2;
      const entry = pages.filter(entry => !entry.canvas && !entry.failed && nearViewport(entry))
        .sort((a, b) => Math.abs(pageTop(a) + a.height / 2 - center) - Math.abs(pageTop(b) + b.height / 2 - center))[0];
      if (!entry) break;
      const token = generation;
      const view = entry.page.getViewport({ scale: entry.scale });
      // Bound each canvas and keep only the visible neighborhood in memory.
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8000000 / (view.width * view.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(view.width * ratio); canvas.height = Math.floor(view.height * ratio);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${item.title}，第 ${entry.number} 页，共 ${pdf.numPages} 页`);
      try {
        renderTask = entry.page.render({ canvasContext: canvas.getContext('2d'), viewport: view, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
        await renderTask.promise;
        if (token !== generation || !nearViewport(entry, 2)) {
          canvas.width = canvas.height = 0;
          continue;
        }
        entry.canvas = canvas;
        entry.element.append(canvas);
        entry.placeholder.hidden = true;
      } catch (error) {
        canvas.width = canvas.height = 0;
        if (token !== generation || error.name === 'RenderingCancelledException') continue;
        entry.failed = true;
        entry.placeholder.replaceChildren();
        const retry = document.createElement('button'); retry.className = 'page-retry';
        retry.textContent = `第 ${entry.number} 页加载失败，点击重试`;
        retry.addEventListener('click', () => {
          entry.failed = false; entry.placeholder.textContent = `正在加载第 ${entry.number} 页…`; renderNearbyPages();
        });
        entry.placeholder.append(retry);
        console.error(error);
      } finally {
        renderTask = null;
      }
    }
  } finally {
    rendering = false;
  }
}
function updateVisiblePages() {
  if (!ready) return;
  for (const entry of pages) if (!nearViewport(entry, 2)) releaseCanvas(entry);
  updateControls();
  renderNearbyPages();
}
function layoutPages(position = readingPosition()) {
  generation++;
  renderTask?.cancel();
  const padding = getComputedStyle(viewport);
  const width = viewport.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
  layoutWidth = viewport.clientWidth;
  for (const entry of pages) {
    releaseCanvas(entry);
    entry.scale = Math.min(width, 1000) / entry.natural.width * zoom;
    entry.height = Math.floor(entry.natural.height * entry.scale);
    entry.element.style.width = `${Math.floor(entry.natural.width * entry.scale)}px`;
    entry.element.style.height = `${entry.height}px`;
  }
  const number = Number(position.page);
  const index = Math.max(0, Math.min(pages.length - 1, Number.isFinite(number) ? Math.trunc(number) - 1 : 0));
  const entry = pages[index];
  const offset = Math.min(1, Math.max(0, Number(position.offset) || 0));
  viewport.scrollTop = pageTop(entry) + entry.height * offset;
  updateVisiblePages();
}
function changeZoom(value) {
  const position = readingPosition();
  const horizontalFraction = viewport.scrollLeft / Math.max(1, viewport.scrollWidth - viewport.clientWidth);
  zoom = Math.min(3, Math.max(1, value));
  layoutPages(position);
  viewport.scrollLeft = horizontalFraction * Math.max(0, viewport.scrollWidth - viewport.clientWidth);
}
$('#zoom-out').addEventListener('click', () => changeZoom(zoom - .25));
$('#zoom-in').addEventListener('click', () => changeZoom(zoom + .25));
$('#fit').addEventListener('click', () => changeZoom(1));
viewport.addEventListener('scroll', () => {
  if (!ready) return;
  if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = null; updateVisiblePages(); });
  clearTimeout(saveTimer); saveTimer = setTimeout(saveProgress, 180);
}, { passive: true });
window.addEventListener('pagehide', saveProgress);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!ready) return;
    if (viewport.clientWidth !== layoutWidth) layoutPages();
    else updateVisiblePages();
  }, 150);
}).observe(viewport);

try {
  const response = await fetch('catalog.json');
  if (!response.ok) throw new Error('Catalog unavailable');
  const catalog = await response.json();
  const id = new URLSearchParams(location.search).get('id');
  item = catalog.find(entry => entry.id === id);
  if (!item) throw new Error('Unknown document');
  const kind = item.kind === 'papers' ? '原题' : '答案解析';
  $('#document-title').textContent = item.title;
  $('#document-kind').textContent = `${kind} · 阅读进度自动保存`;
  document.title = `${item.title} · ${kind} · 六级随身读`;
  $('#back').href = `./#${item.kind}`;
  $('#download').href = item.file; $('#download').hidden = false;
  const pair = catalog.find(entry => entry.exam === item.exam && entry.set === item.set && entry.kind !== item.kind);
  if (pair) { $('#pair-link').href = `reader.html?id=${encodeURIComponent(pair.id)}`; $('#pair-link').textContent = item.kind === 'papers' ? '查看本套答案 ↗' : '查看本套原题 ↗'; $('#pair-link').hidden = false; }
  const pdfjs = await import('./vendor/pdfjs/pdf.min.js');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
  const task = pdfjs.getDocument({
    url: new URL(item.file, location.href).href,
    cMapUrl: new URL('./vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true,
    standardFontDataUrl: new URL('./vendor/pdfjs/standard_fonts/', import.meta.url).href,
    wasmUrl: new URL('./vendor/pdfjs/wasm/', import.meta.url).href,
    isEvalSupported: false
  });
  task.onProgress = ({ loaded, total }) => { if (!ready && total > 0) $('#status-text').textContent = `正在加载 PDF · ${Math.min(100, Math.round(loaded / total * 100))}%`; };
  pdf = await task.promise;
  const pageProxies = await Promise.all(Array.from({ length: pdf.numPages }, (_, index) => pdf.getPage(index + 1)));
  pages = pageProxies.map((page, index) => {
    const element = document.createElement('div'); element.className = 'pdf-page';
    element.setAttribute('role', 'group'); element.setAttribute('aria-label', `第 ${index + 1} 页`);
    const placeholder = document.createElement('div'); placeholder.className = 'page-placeholder';
    placeholder.textContent = `正在加载第 ${index + 1} 页…`; element.append(placeholder);
    pagesContainer.append(element);
    return { number: index + 1, page, natural: page.getViewport({ scale: 1 }), element, placeholder, canvas: null, failed: false };
  });
  $('#page-total').textContent = pdf.numPages;
  ready = true;
  layoutPages(savedPosition(item.id));
  $('#status').hidden = true;
} catch (error) {
  ready = false; updateControls();
  errorState(item ? 'PDF 没有加载成功，请检查网络后重试。' : '没有找到这份资料，请返回书架重新选择。');
  console.error(error);
}
