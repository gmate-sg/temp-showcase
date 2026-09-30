const $ = (selector) => document.querySelector(selector);
const categories = [
  { id: 'styles', name: '视觉风格', en: 'VISUAL LANGUAGE', note: '排版、质感与构图' },
  { id: 'css', name: 'CSS 与布局', en: 'CSS & LAYOUT', note: '网页的结构与表现' },
  { id: 'motion', name: '动效与滚动', en: 'MOTION & SCROLL', note: '时间维度的表达' },
  { id: 'graphics', name: '3D 与图形', en: '3D & GRAPHICS', note: '把画面带入空间' },
  { id: 'frameworks', name: '框架与组件', en: 'UI & FRAMEWORKS', note: '构建界面的组织方式' },
  { id: 'data', name: '状态与数据', en: 'STATE & DATA', note: '让交互保持一致' },
  { id: 'platform', name: '浏览器能力', en: 'WEB PLATFORM', note: '连接设备与环境' },
  { id: 'delivery', name: '性能与工程', en: 'PERFORMANCE & BUILD', note: '更快、更可靠地交付' },
  { id: 'quality', name: '体验与质量', en: 'ACCESSIBILITY & TEST', note: '让更多人顺畅使用' },
  { id: 'emerging', name: '前沿与实验', en: 'EMERGING FEATURES', note: '探索下一步的可能' },
];
const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
const state = { entries: [], category: 'all', kind: 'all', query: '', visible: 24, activeEntry: null };
let saved;
try { saved = new Set(JSON.parse(localStorage.getItem('frame-atlas.saved.v1') || '[]')); }
catch { saved = new Set(); }
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const normalized = (text) => String(text).normalize('NFKC').toLowerCase().replace(/[.-]/g, '');
const bookmarkIcon = '<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M2 1h12v17l-6-4-6 4z"/></svg>';
function preview(entry) {
  const demo = /^[a-z0-9-]+$/.test(entry.demo) ? entry.demo : 'code';
  const label = demo === 'terminal' ? 'build the web' : demo === 'swiss' ? 'Aa / 01' : demo === 'editorial' ? 'The Art of Web' : demo === 'kinetic' ? 'FORM' : entry.kind === 'style' ? 'Design.' : 'Build.';
  return `<div class="demo demo-${escape(demo)}" aria-hidden="true"><div class="mini-frame"><div class="mini-head"><i></i><i></i><i></i><span></span></div><div class="mini-title">${label}</div><div class="mini-subtitle"></div><div class="mini-grid"><div></div><div></div><div></div></div></div><span class="demo-label">${escape(entry.en.toUpperCase())}</span></div>`;
}
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $('#toast').classList.remove('visible'), 2200);
}
function updateSaved() { $('#saved-count').textContent = saved.size; }
function toggleSaved(id) {
  if (saved.has(id)) { saved.delete(id); notify('已取消收藏'); }
  else { saved.add(id); notify('已加入本机收藏'); }
  try { localStorage.setItem('frame-atlas.saved.v1', JSON.stringify([...saved])); }
  catch { notify('浏览器未允许保存，收藏仅在本次浏览中保留'); }
  updateSaved();
  if (state.kind === 'saved') renderCatalog();
  else document.querySelectorAll(`.card-save[data-save="${id}"]`).forEach((button) => {
    button.classList.toggle('is-saved', saved.has(id));
    button.setAttribute('aria-pressed', String(saved.has(id)));
    button.setAttribute('aria-label', `${saved.has(id) ? '取消收藏' : '收藏'} ${state.entries.find((e) => e.id === id)?.name || ''}`);
  });
  if (state.activeEntry?.id === id) updateDetailSave();
}
function renderOverview() {
  $('#total-count').textContent = state.entries.length;
  $('#category-map').innerHTML = categories.map((c, i) => {
    const count = state.entries.filter((e) => e.category === c.id).length;
    return `<button class="category-tile" data-category="${c.id}" aria-label="检索${c.name}，${count}项"><div class="category-top"><span>${String(i + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')} 项</span><b>↗</b></div><h3>${c.name}</h3><p>${c.en}</p></button>`;
  }).join('');
  const specimens = ['bento', 'glass', 'swiss', 'brutal', 'editorial', 'generative'];
  $('#style-showcase').innerHTML = specimens.map((key) => {
    const e = state.entries.find((entry) => entry.kind === 'style' && entry.demo === key);
    return e ? `<button class="style-card" data-open="${e.id}" aria-label="了解${escape(e.name)}">${preview(e)}<div class="style-caption"><div><h3>${escape(e.name)}</h3><p>${escape(e.en)}</p></div><span>↗</span></div></button>` : '';
  }).join('');
  $('#category-filters').innerHTML = `<button data-filter="all" class="active" aria-pressed="true">全部门类</button>` + categories.map((c) => `<button data-filter="${c.id}" aria-pressed="false">${c.name}</button>`).join('');
}
function filteredEntries() {
  const terms = normalized(state.query).trim().split(/\s+/).filter(Boolean);
  return state.entries.filter((entry) => {
    const categoryMatch = state.category === 'all' || entry.category === state.category;
    const kindMatch = state.kind === 'all' || (state.kind === 'saved' ? saved.has(entry.id) : entry.kind === state.kind);
    const searchable = normalized([entry.name, entry.en, entry.description, categoryById[entry.category].name, ...(entry.tags || [])].join(' '));
    return categoryMatch && kindMatch && terms.every((term) => searchable.includes(term));
  });
}
function renderCatalog() {
  const results = filteredEntries();
  $('#result-count').textContent = `找到 ${results.length} 项 · 当前显示 ${Math.min(state.visible, results.length)} 项`;
  $('#clear-filters').hidden = state.category === 'all' && state.kind === 'all' && !state.query;
  $('#empty-state').hidden = results.length > 0;
  $('#load-more').hidden = results.length <= state.visible;
  $('#catalog-grid').innerHTML = results.slice(0, state.visible).map((entry) => `<article class="catalog-card"><button class="card-open" data-open="${entry.id}" aria-label="查看${escape(entry.name)}详情">${preview(entry)}<div class="card-content"><div class="card-meta"><span>${categoryById[entry.category].name}</span><span class="dot"></span><span>${entry.kind === 'style' ? '视觉模式' : entry.level}</span></div><h3>${escape(entry.name)}</h3><p class="card-en">${escape(entry.en)}</p><p class="card-desc">${escape(entry.description)}</p></div></button><button class="card-save ${saved.has(entry.id) ? 'is-saved' : ''}" data-save="${entry.id}" aria-label="${saved.has(entry.id) ? '取消收藏' : '收藏'} ${escape(entry.name)}" aria-pressed="${saved.has(entry.id)}">${bookmarkIcon}</button></article>`).join('');
  document.querySelectorAll('[data-filter]').forEach((button) => { const active = button.dataset.filter === state.category; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  document.querySelectorAll('[data-kind]').forEach((button) => { const active = button.dataset.kind === state.kind; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}
function filter({ category = state.category, kind = state.kind, query = state.query } = {}, scroll = false) {
  state.category = category; state.kind = kind; state.query = query; state.visible = 24;
  $('#search').value = query;
  renderCatalog();
  if (scroll) $('#library').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
function reset() { filter({ category: 'all', kind: 'all', query: '' }); }
function updateDetailSave() {
  const active = saved.has(state.activeEntry.id);
  $('#detail-save').textContent = active ? '已收藏 · 点击取消 ✓' : '收藏此条目 ♧';
  $('#detail-save').setAttribute('aria-pressed', String(active));
}
function openDetail(id) {
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return;
  state.activeEntry = entry;
  $('#detail-category').textContent = `${categoryById[entry.category].en} / ${entry.kind === 'style' ? 'STYLE' : 'TECHNOLOGY'}`;
  $('#detail-preview').innerHTML = preview(entry);
  $('#detail-en').textContent = entry.en;
  $('#detail-title').textContent = entry.name;
  $('#detail-description').textContent = entry.description;
  $('#detail-badges').innerHTML = [...new Set([entry.kind === 'style' ? '视觉模式' : entry.level, entry.support])].map((value) => `<span>${escape(value)}</span>`).join('');
  $('#detail-uses').innerHTML = entry.useCases.map((value) => `<li>${escape(value)}</li>`).join('');
  $('#detail-tags').innerHTML = entry.tags.map((value) => `<span>${escape(value)}</span>`).join('');
  const related = (entry.related || []).map((r) => state.entries.find((e) => e.id === r)).filter(Boolean);
  $('#detail-related-wrap').hidden = related.length === 0;
  $('#detail-related').innerHTML = related.map((e) => `<button data-open="${e.id}">${escape(e.name)} ↗</button>`).join('');
  $('#detail-doc').href = /^https:\/\//.test(entry.doc) ? entry.doc : 'https://developer.mozilla.org/zh-CN/docs/Web';
  updateDetailSave();
  const dialog = $('#detail-dialog');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  $('#detail-close').focus();
}
document.addEventListener('click', (event) => {
  const open = event.target.closest('[data-open]');
  const save = event.target.closest('[data-save]');
  const cat = event.target.closest('[data-category]');
  const categoryFilter = event.target.closest('[data-filter]');
  const kind = event.target.closest('[data-kind]');
  if (open) openDetail(open.dataset.open);
  if (save) toggleSaved(save.dataset.save);
  if (cat) filter({ category: cat.dataset.category, kind: 'all', query: '' }, true);
  if (categoryFilter) filter({ category: categoryFilter.dataset.filter });
  if (kind) filter({ kind: kind.dataset.kind, category: kind.dataset.kind === 'style' ? 'styles' : (state.category === 'styles' ? 'all' : state.category) });
});
$('#search').addEventListener('input', () => filter({ query: $('#search').value }));
$('#all-styles').addEventListener('click', () => filter({ category: 'styles', kind: 'style', query: '' }, true));
$('#saved-nav').addEventListener('click', () => filter({ category: 'all', kind: 'saved', query: '' }, true));
$('#three-details').addEventListener('click', () => openDetail('three-js'));
$('#clear-filters').addEventListener('click', reset);
$('#empty-reset').addEventListener('click', reset);
$('#load-more').addEventListener('click', () => { state.visible += 24; renderCatalog(); });
$('#detail-close').addEventListener('click', () => $('#detail-dialog').close());
$('#detail-save').addEventListener('click', () => toggleSaved(state.activeEntry.id));
$('#detail-dialog').addEventListener('click', (event) => { if (event.target === $('#detail-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) && !$('#detail-dialog').open) { event.preventDefault(); $('#library').scrollIntoView(); $('#search').focus({ preventScroll: true }); }
});
updateSaved();
try {
  const response = await fetch('./catalog.json');
  if (!response.ok) throw new Error(`Catalog ${response.status}`);
  state.entries = await response.json();
  // Interleave categories so the initial catalog presents the full landscape.
  const groups = categories.map((c) => state.entries.filter((e) => e.category === c.id));
  state.entries = [];
  for (let i = 0; groups.some((g) => g[i]); i++) groups.forEach((g) => { if (g[i]) state.entries.push(g[i]); });
  const ids = new Set(state.entries.map((e) => e.id));
  saved = new Set([...saved].filter((id) => ids.has(id)));
  updateSaved(); renderOverview(); renderCatalog();
} catch (error) {
  $('#result-count').textContent = '图谱暂未加载。请刷新页面重试。';
  $('#catalog-grid').innerHTML = '<p>可以先体验 Three.js 实验室，或访问页面底部的官方资料。</p>';
  console.warn('Catalog unavailable:', error.message);
}
import('./graphics.js').then(({ initGraphics }) => initGraphics()).catch(() => {
  $('#hero-fallback').hidden = false; $('#lab-fallback').hidden = false;
  $('#hero-pause').disabled = true;
});
