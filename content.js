// Traditional British teaching inventory. Examples match supplied local recordings.
// Brackets identify letters associated with the sound, not complete spelling rules.
const rows = [
  ['ee', 'iː', 'vowel', '长元音', 'vowel-i-long', 'b[ee]|蜜蜂', 'w[e]|我们', 'r[ea]d|阅读'],
  ['ih', 'ɪ', 'vowel', '短元音', 'vowel-i-short', 'l[i]ttle|小的', 's[i]t|坐', 'f[i]sh|鱼'],
  ['e', 'e', 'vowel', '短元音', 'vowel-e-short', 'b[e]d|床', 'r[e]d|红色', '[e]gg|鸡蛋'],
  ['ae', 'æ', 'vowel', '短元音', 'vowel-ae-short', 'c[a]t|猫', '[a]nt|蚂蚁', 'l[a]mb|小羊'],
  ['ah', 'ɑː', 'vowel', '长元音', 'vowel-a-long', 'm[ar]k|标记', 'sh[ar]k|鲨鱼', 'f[a]ther|爸爸'],
  ['o', 'ɒ', 'vowel', '短元音', 'vowel-o-short', 'd[o]g|狗', 'b[o]x|盒子', 'st[o]p|停止'],
  ['aw', 'ɔː', 'vowel', '长元音', 'vowel-aw-long', 'c[augh]t|抓住了', 'w[al]k|走路', 'b[oar]d|木板'],
  ['uh', 'ʊ', 'vowel', '短元音', 'vowel-u-short', 'b[oo]k|书', 'g[oo]d|好的', 'f[u]ll|满的'],
  ['oo', 'uː', 'vowel', '长元音', 'vowel-u-long', 'c[oo]l|凉爽的', 'r[u]de|不礼貌的', 't[oo]th|牙齿'],
  ['cup', 'ʌ', 'vowel', '短元音', 'vowel-uh-short', 'c[u]p|杯子', 'b[u]s|公共汽车', 's[u]n|太阳'],
  ['er', 'ɜː', 'vowel', '长元音', 'vowel-er-long', 'b[ir]d|鸟', 'w[or]d|单词', 'w[or]k|工作'],
  ['schwa', 'ə', 'vowel', '短元音', 'vowel-schwa-short', 'cent[er]|中心', 'pand[a]|熊猫', 'act[or]|演员'],
  ['ay', 'eɪ', 'vowel', '双元音', 'diphthong-ei', 'w[ai]t|等待', 'l[a]te|迟到的', 'g[a]te|大门'],
  ['eye', 'aɪ', 'vowel', '双元音', 'diphthong-ai', 'm[y]|我的', 'wh[y]|为什么', 'wr[i]te|写'],
  ['oy', 'ɔɪ', 'vowel', '双元音', 'diphthong-oi', 'n[oi]se|噪声', 'p[oi]nt|指向', '[oi]l|油'],
  ['ow', 'aʊ', 'vowel', '双元音', 'diphthong-au', 'm[ou]se|老鼠', 't[ow]n|小镇', 'cl[ou]d|云'],
  ['oh', 'əʊ', 'vowel', '双元音', 'diphthong-ou', 'n[o]|不', 'h[o]me|家', 'kn[ow]|知道'],
  ['ear', 'ɪə', 'vowel', '双元音', 'diphthong-ear', 'd[eer]|鹿', 'b[eer]|啤酒', 'm[ere]|仅有的'],
  ['air', 'eə', 'vowel', '双元音', 'diphthong-air', 'b[ear]|熊', 'w[ear]|穿着', 'f[are]|车费'],
  ['ure', 'ʊə', 'vowel', '双元音', 'diphthong-ure', 'p[oor]|贫穷的', 't[our]|旅行', 'p[ure]|纯净的'],
  ['p', 'p', 'consonant', '清辅音', 'consonant-p', 'si[p]|小口喝', '[p]ut|放', 'cu[p]|杯子'],
  ['b', 'b', 'consonant', '浊辅音', 'consonant-b', '[b]ook|书', '[b]ed|床', '[b]us|公共汽车'],
  ['t', 't', 'consonant', '清辅音', 'consonant-t', '[t]op|顶部', 'ca[t]|猫', 'si[t]|坐'],
  ['d', 'd', 'consonant', '浊辅音', 'consonant-d', '[d]og|狗', 'car[d]|卡片', 'be[d]|床'],
  ['k', 'k', 'consonant', '清辅音', 'consonant-k', '[c]at|猫', '[c]up|杯子', '[c]ard|卡片'],
  ['g', 'ɡ', 'consonant', '浊辅音', 'consonant-g', 'e[gg]|鸡蛋', 'di[g]|挖', '[g]ate|大门'],
  ['f', 'f', 'consonant', '清辅音', 'consonant-f', '[f]ish|鱼', '[f]ree|自由的', '[f]loor|地板'],
  ['v', 'v', 'consonant', '浊辅音', 'consonant-v', '[v]ery|非常', 'do[v]e|鸽子', 'e[v]er|曾经'],
  ['th', 'θ', 'consonant', '清辅音', 'consonant-th-soft', 'pa[th]|小路', '[th]ink|想', 'ma[th]|数学'],
  ['dh', 'ð', 'consonant', '浊辅音', 'consonant-th-voice', '[th]ey|他们', '[th]ose|那些', 'o[th]er|其他的'],
  ['s', 's', 'consonant', '清辅音', 'consonant-s', 'ni[c]e|美好的', 'bu[s]|公共汽车', '[s]it|坐'],
  ['z', 'z', 'consonant', '浊辅音', 'consonant-z', '[z]ero|零', 'si[z]e|大小', 'noi[s]e|噪声'],
  ['sh', 'ʃ', 'consonant', '清辅音', 'consonant-sh', '[sh]ip|轮船', 'fi[sh]|鱼', '[sh]irt|衬衫'],
  ['zh', 'ʒ', 'consonant', '浊辅音', 'consonant-zh', 'deci[s]ion|决定', 'televi[s]ion|电视', 'lei[s]ure|闲暇'],
  ['h', 'h', 'consonant', '清辅音', 'consonant-h', '[h]ut|小屋', '[h]ello|你好', '[h]ome|家'],
  ['ch', 'tʃ', 'consonant', '清辅音', 'consonant-ch', '[ch]ick|小鸡', 'coa[ch]|教练', 'ri[ch]|富有的'],
  ['j', 'dʒ', 'consonant', '浊辅音', 'consonant-j', '[j]am|果酱', 'bri[dge]|桥', '[J]uly|七月'],
  ['m', 'm', 'consonant', '鼻音', 'consonant-m', 's[m]art|聪明的', '[m]ove|移动', '[m]ud|泥巴'],
  ['n', 'n', 'consonant', '鼻音', 'consonant-n', '[n]o|不', 'hu[n]t|寻找', 'fi[n]d|找到'],
  ['ng', 'ŋ', 'consonant', '鼻音', 'consonant-ng', 'spri[ng]|春天', 'si[ng]|唱歌', 'i[n]k|墨水'],
  ['l', 'l', 'consonant', '近音', 'consonant-l', '[l]ine|线', 'poo[l]|水池', 'a[l]ive|活着的'],
  ['r', 'r', 'consonant', '近音', 'consonant-r', '[r]ead|阅读', 'g[r]ass|草', 'w[r]ite|写'],
  ['y', 'j', 'consonant', '半元音', 'consonant-y', '[y]ell|大喊', '[y]ak|牦牛', '[y]outh|青春'],
  ['w', 'w', 'consonant', '半元音', 'consonant-w', '[w]ork|工作', '[w]ood|木头', '[wh]at|什么'],
];

export const phonemes = rows.map(([slug, ipa, group, kind, sourcePhonemeId, ...examples]) => ({
  id: `phoneme-${slug}`, ipa, group, kind, sourcePhonemeId,
  words: examples.map(example => {
    const [marked, meaning] = example.split('|');
    const word = marked.replace(/[\[\]]/g, '');
    return {id: `word-${word.toLowerCase()}`, word, marked, meaning};
  }),
}));

export const clipIds = [...new Set(phonemes.flatMap(item => [item.id, ...item.words.map(word => word.id)]))];
