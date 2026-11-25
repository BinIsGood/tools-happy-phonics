(() => {
  const groups = [
    ['initial', '声母', [
      ['b', 'bop-01', 'bā', '八', 'ba1'], ['p', 'bop-02', 'pá', '爬', 'pa2'],
      ['m', 'bop-03', 'mā', '妈', 'ma1'], ['f', 'bop-04', 'fā', '发', 'fa1'],
      ['d', 'bop-05', 'dà', '大', 'da4'], ['t', 'bop-06', 'tǎ', '塔', 'ta3'],
      ['n', 'bop-07', 'nǐ', '你', 'ni3'], ['l', 'bop-08', 'lù', '路', 'lu4'],
      ['g', 'bop-09', 'gǒu', '狗', 'gou3'], ['k', 'bop-10', 'kǒu', '口', 'kou3'],
      ['h', 'bop-11', 'hē', '喝', 'he1'], ['j', 'bop-12', 'jī', '鸡', 'ji1'],
      ['q', 'bop-13', 'qī', '七', 'qi1'], ['x', 'bop-14', 'xī', '西', 'xi1'],
      ['zh', 'bop-15', 'zhú', '竹', 'zhu2'], ['ch', 'bop-16', 'chē', '车', 'che1'],
      ['sh', 'bop-17', 'shū', '书', 'shu1'], ['r', 'bop-18', 'rì', '日', 'ri4'],
      ['z', 'bop-19', 'zǒu', '走', 'zou3'], ['c', 'bop-20', 'cǎo', '草', 'cao3'],
      ['s', 'bop-21', 'sān', '三', 'san1'], ['y', 'yi1', 'yī', '衣', 'yi1', '', 'yī'],
      ['w', 'wu1', 'wū', '屋', 'wu1', '', 'wū'],
    ]],
    ['final', '韵母', [
      ['a', 'bop-22', 'ā', '啊', 'a1'], ['o', 'bop-23', 'bō', '波', 'bo1'],
      ['e', 'bop-24', 'é', '鹅', 'e2'], ['i', 'bop-35', 'yī', '衣', 'yi1'],
      ['u', 'bop-36', 'wū', '屋', 'wu1'], ['ü', 'bop-37', 'yú', '鱼', 'yu2'],
      ['ai', 'bop-26', 'ài', '爱', 'ai4'], ['ei', 'bop-27', 'bēi', '杯', 'bei1'],
      ['ui', 'wei1', 'shuǐ', '水', 'shui3', '韵母 · uei', 'wēi'], ['ao', 'bop-28', 'māo', '猫', 'mao1'],
      ['ou', 'bop-29', 'gǒu', '狗', 'gou3'], ['iu', 'you1', 'niú', '牛', 'niu2', '韵母 · iou', 'yōu'],
      ['ie', 'ye1', 'yè', '叶', 'ye4', '', 'yē'], ['üe', 'yue1', 'yuè', '月', 'yue4', '', 'yuē'],
      ['er', 'bop-34', 'ěr', '耳', 'er3'], ['an', 'bop-30', 'ān', '安', 'an1'],
      ['en', 'bop-31', 'mén', '门', 'men2'], ['in', 'yin1', 'yīn', '音', 'yin1', '', 'yīn'],
      ['un', 'wen1', 'lún', '轮', 'lun2', '韵母 · uen', 'wēn'], ['ün', 'yun1', 'yún', '云', 'yun2', '', 'yūn'],
      ['ang', 'bop-32', 'yáng', '羊', 'yang2'], ['eng', 'bop-33', 'dēng', '灯', 'deng1'],
      ['ing', 'ying1', 'xīng', '星', 'xing1', '', 'yīng'], ['ong', 'final-ong', 'dōng', '东', 'dong1'],
    ]],
    ['syllable', '整体认读', [
      ['zhi', 'zhi1', 'zhī', '知', 'zhi1', '', 'zhī'], ['chi', 'chi1', 'chǐ', '尺', 'chi3', '', 'chī'],
      ['shi', 'shi1', 'shí', '十', 'shi2', '', 'shī'], ['ri', 'ri1', 'rì', '日', 'ri4', '', 'rī'],
      ['zi', 'zi1', 'zì', '字', 'zi4', '', 'zī'], ['ci', 'ci1', 'cí', '词', 'ci2', '', 'cī'],
      ['si', 'si1', 'sì', '四', 'si4', '', 'sī'], ['yi', 'yi1', 'yī', '衣', 'yi1', '', 'yī'],
      ['wu', 'wu1', 'wū', '屋', 'wu1', '', 'wū'], ['yu', 'yu1', 'yú', '鱼', 'yu2', '', 'yū'],
      ['ye', 'ye1', 'yè', '叶', 'ye4', '', 'yē'], ['yue', 'yue1', 'yuè', '月', 'yue4', '', 'yuē'],
      ['yuan', 'yuan1', 'yuán', '圆', 'yuan2', '', 'yuān'], ['yin', 'yin1', 'yīn', '音', 'yin1', '', 'yīn'],
      ['yun', 'yun1', 'yún', '云', 'yun2', '', 'yūn'], ['ying', 'ying1', 'yīng', '鹰', 'ying1', '', 'yīng'],
    ]],
    ['tone', '四声', [
      ['mā', 'ma1', 'mā', '妈', 'ma1', '一声 · 平'], ['má', 'ma2', 'má', '麻', 'ma2', '二声 · 扬'],
      ['mǎ', 'ma3', 'mǎ', '马', 'ma3', '三声 · 拐弯'], ['mà', 'ma4', 'mà', '骂', 'ma4', '四声 · 降'],
    ]],
  ];

  globalThis.pinyinLessons = groups.flatMap(([group, label, rows]) => rows.map(
    ([symbol, demoClip, spelling, example, exampleClip, detail, demoSpelling]) => ({
      id: `${group}-${group === 'tone' ? exampleClip : symbol}`,
      group, label, symbol, demoClip, spelling, example, exampleClip, detail, demoSpelling,
    }),
  ));
})();
