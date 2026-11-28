/**
 * 语言切换：整页文本走字典替换，引擎后续插入的文案由 MutationObserver 兜住。
 *
 * 这样做的好处是引擎那 3k 行迁移体不用为 i18n 改一遍：文案还写中文，
 * 展示层按当前语言查字典。
 */
import { currentLang, setLangValue, tr, type Lang } from './i18n';

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'] as const;
const META_ATTRS = ['content'] as const;

const originals = new WeakMap<Node, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
let applying = false;
let observer: MutationObserver | null = null;

const CJK = /[\u4e00-\u9fa5]/;

function translateText(node: Text): void {
  const cur = node.nodeValue ?? '';
  if (!cur) return;

  if (currentLang() === 'zh') {
    const orig = originals.get(node);
    if (orig !== undefined && orig !== cur) node.nodeValue = orig;
    return;
  }
  if (!CJK.test(cur)) return;

  const orig = originals.get(node) ?? cur;
  originals.set(node, orig);
  const next = tr(orig);
  if (next !== cur) node.nodeValue = next;
}

function translateElementAttrs(el: Element): void {
  let map = attrOriginals.get(el);
  if (!map) { map = new Map(); attrOriginals.set(el, map); }
  const names: string[] = el.tagName === 'META'
    ? [...ATTRS, ...META_ATTRS]
    : [...ATTRS];
  for (const name of names) {
    const cur = el.getAttribute(name);
    if (!cur) continue;
    if (currentLang() === 'zh') {
      const orig = map.get(name);
      if (orig && orig !== cur) el.setAttribute(name, orig);
      continue;
    }
    if (!CJK.test(cur)) continue;
    if (!map.has(name)) map.set(name, cur);
    const next = tr(map.get(name)!);
    if (next !== cur) el.setAttribute(name, next);
  }
}

function walk(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

  const el = root as Element;
  if (el.nodeType === Node.ELEMENT_NODE) translateElementAttrs(el);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateElementAttrs(n as Element);
    n = walker.nextNode();
  }
}

/** 对全页 / 子树生效，可反复调用（已翻译过的节点会跳过或还原） */
export function applyLang(root: Node = document.documentElement): void {
  applying = true;
  try { walk(root); } finally { applying = false; }
}

export function switchLang(next: Lang): void {
  setLangValue(next);
  try { localStorage.setItem('aurora-lang', next); } catch { /* ignore */ }
  applyLang(document.documentElement);
  updateToggleLabel();
}

function updateToggleLabel(): void {
  for (const btn of document.querySelectorAll<HTMLElement>('#btnLang')) {
    btn.textContent = currentLang() === 'en' ? '中文' : 'EN';
    btn.title = currentLang() === 'en' ? 'Switch to Chinese / 切换到中文' : 'Switch to English / 切换到英文';
  }
}

export function initLangDom(): void {
  applyLang(document.documentElement);

  observer = new MutationObserver((list) => {
    if (applying) return;
    applying = true;
    try {
      for (const m of list) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          translateText(m.target as Text);
        }
        m.addedNodes.forEach((n) => walk(n));
        if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
          translateElementAttrs(m.target as Element);
        }
      }
    } finally {
      applying = false;
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['title', 'placeholder', 'aria-label', 'alt']
  });

  const btn = document.getElementById('btnLang');
  updateToggleLabel();
  btn?.addEventListener('click', () => {
    switchLang(currentLang() === 'en' ? 'zh' : 'en');
  });
}

export function teardownLangDom(): void {
  observer?.disconnect();
  observer = null;
}
