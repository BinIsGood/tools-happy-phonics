import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const base = 'https://example.test/family-english/';
const localBase = 'file:///D:/workspace/family-english/';
const source = await fs.readFile(new URL('../navigation.js', import.meta.url), 'utf8');
const files = ['index.html', 'phonics.html', 'pinyin.html'];
const pages = await Promise.all(files.map(file => fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8')));

function open(file, localStorage, directory = base) {
  const {document} = parseHTML(pages[files.indexOf(file)]);
  const script = document.querySelector('script[defer][src^="./navigation.js"]');
  assert.ok(script);
  assert.equal(script.hasAttribute('type'), false);
  Object.defineProperty(document, 'currentScript', {value: {src: new URL(script.getAttribute('src'), directory).href}});
  const events = new Map();
  const window = {addEventListener(name, callback) { events.set(name, callback); }};
  vm.runInNewContext(source, {document, navigator: {}, window, localStorage, URL});
  return {
    links: () => [...document.querySelectorAll('#feature-menu a')].map(link => link.getAttribute('href')),
    clickFeature: feature => document.querySelector(`#feature-menu [data-feature="${feature}"] strong`).click(),
    backLink: () => document.querySelector('header a.back-link'),
    restore: () => events.get('pageshow')({persisted: true}),
  };
}

test('the home page puts the most recently opened feature first, including after browser back', () => {
  const saved = new Map();
  const localStorage = {getItem: saved.get.bind(saved), setItem: saved.set.bind(saved)};
  const home = open('index.html', localStorage);
  assert.deepEqual(home.links(), ['./phonics.html', './pinyin.html']);

  open('pinyin.html', localStorage);
  home.restore();
  assert.deepEqual(home.links(), ['./pinyin.html', './phonics.html']);
  assert.deepEqual(open('index.html', localStorage).links(), home.links());

  open('phonics.html', localStorage);
  home.restore();
  assert.deepEqual(home.links(), ['./phonics.html', './pinyin.html']);
});

test('the homepage remembers the clicked feature when local files have separate storage', () => {
  const saved = new Map();
  const homeStorage = {getItem: saved.get.bind(saved), setItem: saved.set.bind(saved)};
  const home = open('index.html', homeStorage, localBase);
  const learningPageStorage = {setItem() {}};
  for (const [feature, expected] of [['pinyin', './pinyin.html'], ['phonics', './phonics.html']]) {
    home.clickFeature(feature);
    open(`${feature}.html`, learningPageStorage, localBase);
    home.restore();
    assert.equal(home.links()[0], expected);
    assert.equal(open('index.html', homeStorage, localBase).links()[0], expected);
  }
});

test('both learning pages link directly to the feature menu on HTTP and local file URLs', () => {
  for (const file of ['phonics.html', 'pinyin.html']) {
    const link = open(file, {setItem() {}}).backLink();
    assert.match(link.textContent, /返回功能选择/);
    for (const directory of [base, localBase]) {
      const destination = new URL(link.getAttribute('href'), new URL(file, directory));
      assert.equal(destination.href, new URL('index.html', directory).href);
    }
  }
});

test('feature links remain in default order when local storage is unavailable', () => {
  const home = open('index.html', {getItem() { throw new Error('Storage unavailable'); }});
  assert.deepEqual(home.links(), ['./phonics.html', './pinyin.html']);
});
