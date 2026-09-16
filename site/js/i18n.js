/* One page, two languages. Query choice takes precedence over a remembered choice. */
(function () {
  'use strict';
  const storageKey = 'zarea-language';
  const supported = value => value === 'en' || value === 'ro';
  const requested = new URL(location.href).searchParams.get('lang');
  let remembered;
  try { remembered = localStorage.getItem(storageKey); } catch (_) { /* Storage is optional. */ }
  const lang = supported(requested) ? requested : supported(remembered) ? remembered : 'en';
  try { localStorage.setItem(storageKey, lang); } catch (_) { /* Query links still work. */ }
  const dictionary = lang === 'ro' ? window.ZareaRomanian : {};
  const own = key => Object.prototype.hasOwnProperty.call(dictionary, key);
  const t = (value, variables) => {
    if (typeof value !== 'string') return value;
    const key = value.trim().replace(/\s+/g, ' ');
    let result = own(value) ? dictionary[value] : own(key) ? value.replace(/\S[\s\S]*\S|\S/, dictionary[key]) : value;
    if (variables) result = result.replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match);
    return result;
  };
  const data = value => Array.isArray(value) ? value.map(data) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, data(item)])) : t(value);
  const translate = root => {
    if (lang === 'en') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement?.closest('script, style, [translate="no"]')) node.nodeValue = t(node.nodeValue);
    }
    root.querySelectorAll('[alt], [title], [aria-label], [aria-valuetext], [placeholder], meta[name="description"], meta[property="og:title"], meta[property="og:description"]').forEach(element => {
      if (element.closest('[translate="no"]')) return;
      ['alt', 'title', 'aria-label', 'aria-valuetext', 'placeholder', 'content'].forEach(attribute => {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, t(element.getAttribute(attribute)));
      });
    });
  };
  window.ZareaI18n = Object.freeze({ lang, locale: lang === 'ro' ? 'ro-RO' : 'en-GB', t, data, translate });
  document.documentElement.lang = lang;
  translate(document.documentElement);
  const links = [...document.querySelectorAll('[data-language]')];
  const updateLinks = () => links.forEach(link => {
    const url = new URL(location.href);
    url.searchParams.set('lang', link.dataset.language);
    link.href = url.pathname + url.search + url.hash;
    if (link.dataset.language === lang) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  updateLinks();
  addEventListener('hashchange', updateLinks);
})();
