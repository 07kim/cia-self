const ROMAJI: Record<string, string> = {
  kya:'キャ', kyu:'キュ', kyo:'キョ', sha:'シャ', shu:'シュ', sho:'ショ', cha:'チャ', chu:'チュ', cho:'チョ', nya:'ニャ', nyu:'ニュ', nyo:'ニョ', hya:'ヒャ', hyu:'ヒュ', hyo:'ヒョ', mya:'ミャ', myu:'ミュ', myo:'ミョ', rya:'リャ', ryu:'リュ', ryo:'リョ', gya:'ギャ', gyu:'ギュ', gyo:'ギョ', bya:'ビャ', byu:'ビュ', byo:'ビョ', pya:'ピャ', pyu:'ピュ', pyo:'ピョ',
  tsu:'ツ', shi:'シ', chi:'チ', fu:'フ', ji:'ジ', dzu:'ヅ',
  a:'ア', i:'イ', u:'ウ', e:'エ', o:'オ', ka:'カ', ki:'キ', ku:'ク', ke:'ケ', ko:'コ', sa:'サ', su:'ス', se:'セ', so:'ソ', ta:'タ', te:'テ', to:'ト', na:'ナ', ni:'ニ', nu:'ヌ', ne:'ネ', no:'ノ', ha:'ハ', hi:'ヒ', he:'ヘ', ho:'ホ', ma:'マ', mi:'ミ', mu:'ム', me:'メ', mo:'モ', ya:'ヤ', yu:'ユ', yo:'ヨ', ra:'ラ', ri:'リ', ru:'ル', re:'レ', ro:'ロ', wa:'ワ', wo:'ヲ', n:'ン', ga:'ガ', gi:'ギ', gu:'グ', ge:'ゲ', go:'ゴ', za:'ザ', zu:'ズ', ze:'ゼ', zo:'ゾ', da:'ダ', di:'ヂ', du:'ヅ', de:'デ', do:'ド', ba:'バ', bi:'ビ', bu:'ブ', be:'ベ', bo:'ボ', pa:'パ', pi:'ピ', pu:'プ', pe:'ペ', po:'ポ',
}
const ROMAJI_KEYS = Object.keys(ROMAJI).sort((a, b) => b.length - a.length)

export function consumeRomaji(buffer: string) {
  let rest = buffer.toLowerCase()
  let output = ''
  while (rest) {
    const key = ROMAJI_KEYS.find((candidate) => rest.startsWith(candidate))
    if (key) { output += ROMAJI[key]; rest = rest.slice(key.length); continue }
    if (ROMAJI_KEYS.some((candidate) => candidate.startsWith(rest))) break
    output += rest[0]
    rest = rest.slice(1)
  }
  return { output, rest }
}

export const QWERTY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
export const KANA_KEYS = ['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ','ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヲ','ン']
