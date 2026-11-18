const files = document.querySelector('#files');
const labels = { papers: '原题', answers: '答案' };
let catalog = [];
function readSaved(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function currentKind() { return location.hash === '#answers' ? 'answers' : 'papers'; }
function render() {
  const kind = currentKind();
  document.querySelector('#folder-title').textContent = labels[kind];
  document.querySelectorAll('[data-kind]').forEach(button => {
    const active = button.dataset.kind === kind;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  files.replaceChildren();
  for (const exam of [...new Set(catalog.map(item => item.exam))]) {
    const title = document.createElement('h3');
    title.className = 'exam-label';
    title.textContent = exam.replace('.', ' / ');
    const list = document.createElement('ul');
    list.className = 'file-list';
    for (const item of catalog.filter(item => item.exam === exam && item.kind === kind)) {
      const row = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'file-link';
      link.href = `reader.html?id=${encodeURIComponent(item.id)}`;
      const icon = document.createElement('span'); icon.className = 'pdf-icon'; icon.textContent = 'PDF'; icon.setAttribute('aria-hidden','true');
      const copy = document.createElement('span'); copy.className = 'file-copy';
      const name = document.createElement('strong'); name.textContent = item.title;
      const meta = document.createElement('small'); meta.textContent = `${kind === 'answers' ? '答案解析' : '真题试卷'} · ${item.pages} 页 · ${(item.bytes / 1048576).toFixed(1)} MB`;
      copy.append(name, meta); link.append(icon, copy);
      const saved = readSaved(`cet6:${item.id}`);
      if (saved?.page >= 1 && saved.page <= item.pages) {
        const progress = document.createElement('span'); progress.className = 'file-progress'; progress.textContent = `读到 ${saved.page} 页`; link.append(progress);
      }
      const arrow = document.createElement('span'); arrow.className = 'file-arrow'; arrow.textContent = '›'; arrow.setAttribute('aria-hidden','true'); link.append(arrow);
      row.append(link); list.append(row);
    }
    files.append(title, list);
  }
  const last = readSaved('cet6:last');
  const item = catalog.find(item => item.id === last?.id);
  const resume = document.querySelector('#resume');
  resume.hidden = !item;
  if (item) {
    resume.href = `reader.html?id=${encodeURIComponent(item.id)}`;
    document.querySelector('#resume-title').textContent = `${item.title} · ${labels[item.kind]}`;
    document.querySelector('#resume-page').textContent = `第 ${Math.min(item.pages, Math.max(1, last.page || 1))} 页 ›`;
  }
}
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => { location.hash = button.dataset.kind; }));
window.addEventListener('hashchange', () => { if (catalog.length) render(); });
window.addEventListener('pageshow', () => { if (catalog.length) render(); });
try {
  const response = await fetch('catalog.json');
  if (!response.ok) throw new Error('目录加载失败');
  catalog = await response.json();
  render();
} catch {
  const box = document.createElement('p'); box.className = 'empty'; box.textContent = '书架暂时没加载出来，请检查网络后重试。';
  const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.addEventListener('click', () => location.reload()); box.append(retry); files.replaceChildren(box);
}
