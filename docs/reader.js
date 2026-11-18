const $ = selector => document.querySelector(selector);
const viewport = $('#viewport');
let pdf, item, pageNumber = 1, zoom = 1, renderTask, renderToken = 0, ready = false;
function savedPage(id) { try { return JSON.parse(localStorage.getItem(`cet6:${id}`))?.page || 1; } catch { return 1; } }
function saveProgress() {
  try {
    const data = { id: item.id, page: pageNumber };
    localStorage.setItem(`cet6:${item.id}`, JSON.stringify(data));
    localStorage.setItem('cet6:last', JSON.stringify(data));
  } catch { /* Reading remains available when browser storage is disabled. */ }
}
function updateControls() {
  $('#previous').disabled = !ready || pageNumber <= 1;
  $('#next').disabled = !ready || pageNumber >= pdf.numPages;
  $('#page-number').disabled = !ready;
  $('#page-number').value = pageNumber;
  $('#zoom-out').disabled = !ready || zoom <= 1;
  $('#zoom-in').disabled = !ready || zoom >= 3;
  $('#fit').disabled = !ready;
  $('#fit').textContent = zoom === 1 ? '适宽' : `${Math.round(zoom * 100)}%`;
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
async function renderPage(resetScroll = true) {
  const token = ++renderToken;
  if (renderTask) renderTask.cancel();
  $('#status').hidden = false;
  $('#status-text').textContent = `正在显示第 ${pageNumber} 页…`;
  updateControls();
  try {
    const page = await pdf.getPage(pageNumber);
    if (token !== renderToken) return;
    const natural = page.getViewport({ scale: 1 });
    const padding = getComputedStyle(viewport);
    const available = viewport.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
    const scale = Math.min(available, 1000) / natural.width * zoom;
    const view = page.getViewport({ scale });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16000000 / (view.width * view.height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(view.width * pixelRatio); canvas.height = Math.floor(view.height * pixelRatio);
    canvas.style.width = `${Math.floor(view.width)}px`; canvas.style.height = `${Math.floor(view.height)}px`;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${item.title}，第 ${pageNumber} 页，共 ${pdf.numPages} 页`);
    const task = page.render({ canvasContext: canvas.getContext('2d'), viewport: view, transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
    renderTask = task;
    await task.promise;
    if (token !== renderToken) return;
    renderTask = null;
    $('#canvas-wrap').replaceChildren(canvas);
    $('#status').hidden = true;
    if (resetScroll) viewport.scrollTo(0, 0);
    saveProgress();
  } catch (error) {
    if (token !== renderToken || error.name === 'RenderingCancelledException') return;
    ready = false; updateControls();
    errorState('这一页暂时无法显示，可以重新加载或直接打开 PDF。');
    console.error(error);
  }
}
function goTo(number) {
  if (!ready) return;
  const next = Math.min(pdf.numPages, Math.max(1, Number.isFinite(number) ? Math.trunc(number) : 1));
  if (next === pageNumber) { $('#page-number').value = pageNumber; return; }
  pageNumber = next; renderPage();
}
$('#previous').addEventListener('click', () => goTo(pageNumber - 1));
$('#next').addEventListener('click', () => goTo(pageNumber + 1));
$('#page-form').addEventListener('submit', event => { event.preventDefault(); goTo(Number($('#page-number').value)); $('#page-number').blur(); });
$('#page-number').addEventListener('change', () => goTo(Number($('#page-number').value)));
$('#zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom - .25); renderPage(false); });
$('#zoom-in').addEventListener('click', () => { zoom = Math.min(3, zoom + .25); renderPage(false); });
$('#fit').addEventListener('click', () => { zoom = 1; renderPage(); });
document.addEventListener('keydown', event => {
  if (event.target.matches('input,button,a') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); goTo(pageNumber + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(pageNumber - 1); }
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (ready) renderPage(false); }, 150); });
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
  const previous = Number(savedPage(item.id));
  pageNumber = Math.max(1, Math.min(pdf.numPages, Number.isFinite(previous) ? Math.trunc(previous) : 1));
  $('#page-total').textContent = pdf.numPages; $('#page-number').max = pdf.numPages;
  ready = true; await renderPage();
} catch (error) {
  errorState(item ? 'PDF 没有加载成功，请检查网络后重试。' : '没有找到这份资料，请返回书架重新选择。');
  console.error(error);
}
