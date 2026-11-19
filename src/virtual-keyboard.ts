const ROMAJI: Record<string, string> = {
  kya:'キャ', kyi:'キィ', kyu:'キュ', kye:'キェ', kyo:'キョ', sha:'シャ', shu:'シュ', she:'シェ', sho:'ショ', sya:'シャ', syu:'シュ', syo:'ショ', ja:'ジャ', ju:'ジュ', je:'ジェ', jo:'ジョ', zya:'ジャ', zyu:'ジュ', zye:'ジェ', zyo:'ジョ', cha:'チャ', chu:'チュ', che:'チェ', cho:'チョ', nya:'ニャ', nyu:'ニュ', nye:'ニェ', nyo:'ニョ', hya:'ヒャ', hyu:'ヒュ', hye:'ヒェ', hyo:'ヒョ', mya:'ミャ', myu:'ミュ', mye:'ミェ', myo:'ミョ', rya:'リャ', ryu:'リュ', rye:'リェ', ryo:'リョ', gya:'ギャ', gyu:'ギュ', gye:'ギェ', gyo:'ギョ', bya:'ビャ', byu:'ビュ', byo:'ビョ', pya:'ピャ', pyu:'ピュ', pyo:'ピョ',
  tsu:'ツ', tsi:'ツィ', tsa:'ツァ', tse:'ツェ', tso:'ツォ', shi:'シ', chi:'チ', ti:'ティ', di:'ディ', du:'ヅ', fu:'フ', hu:'フ', fa:'ファ', fi:'フィ', fe:'フェ', fo:'フォ', fya:'フィャ', fyu:'フュ', fyo:'フィョ', ji:'ジ', dzu:'ヅ', va:'ヴァ', vi:'ヴィ', vu:'ヴ', ve:'ヴェ', vo:'ヴォ', wi:'ウィ', we:'ウェ', wo:'ヲ',
  ye:'イェ',
  xa:'ァ', xi:'ィ', xu:'ゥ', xe:'ェ', xo:'ォ', xya:'ャ', xyu:'ュ', xyo:'ョ', lya:'ャ', lyu:'ュ', lyo:'ョ', xtsu:'ッ', ltsu:'ッ', xwa:'ヮ', ltu:'ッ',
  a:'ア', i:'イ', u:'ウ', e:'エ', o:'オ', ka:'カ', ca:'カ', ki:'キ', ci:'シ', ku:'ク', cu:'ク', ke:'ケ', ce:'セ', ko:'コ', co:'コ', kwa:'クァ', kwi:'クィ', kwe:'クェ', kwo:'クォ', sa:'サ', si:'シ', su:'ス', se:'セ', so:'ソ', ta:'タ', tha:'テャ', thi:'ティ', thu:'テュ', the:'テェ', tho:'テョ', te:'テ', to:'ト', tu:'ツ', twa:'トァ', twi:'トィ', twe:'トェ', two:'トォ', na:'ナ', ni:'ニ', nu:'ヌ', ne:'ネ', no:'ノ', ha:'ハ', hi:'ヒ', he:'ヘ', ho:'ホ', ma:'マ', mi:'ミ', mu:'ム', me:'メ', mo:'モ', ya:'ヤ', yu:'ユ', yo:'ヨ', ra:'ラ', ri:'リ', ru:'ル', re:'レ', ro:'ロ', wa:'ワ', n:'ン', ga:'ガ', gi:'ギ', gu:'グ', ge:'ゲ', go:'ゴ', gwa:'グァ', gwi:'グィ', gwe:'グェ', gwo:'グォ', za:'ザ', zi:'ジ', zu:'ズ', ze:'ゼ', zo:'ゾ', da:'ダ', dya:'ヂャ', dyu:'ヂュ', dye:'ヂェ', dyo:'ヂョ', dha:'デャ', dhi:'ディ', dhu:'デュ', dhe:'デェ', dho:'デョ', de:'デ', do:'ド', ba:'バ', bi:'ビ', bu:'ブ', be:'ベ', bo:'ボ', pa:'パ', pi:'ピ', pu:'プ', pe:'ペ', po:'ポ',
}
const ROMAJI_KEYS = Object.keys(ROMAJI).sort((a, b) => b.length - a.length)

export function consumeRomaji(buffer: string) {
  let rest = buffer.toLowerCase()
  let output = ''
  while (rest) {
    if (rest === 'n') break
    if (rest.startsWith('nn')) { output += 'ン'; rest = rest.slice(2); continue }
    if (rest.length > 1 && rest[0] === rest[1] && /[bcdfghjklmpqrstvwxyz]/.test(rest[0])) { output += 'ッ'; rest = rest.slice(1); continue }
    const key = ROMAJI_KEYS.find((candidate) => rest.startsWith(candidate))
    if (key) { output += ROMAJI[key]; rest = rest.slice(key.length); continue }
    if (ROMAJI_KEYS.some((candidate) => candidate.startsWith(rest))) break
    output += rest[0]
    rest = rest.slice(1)
  }
  return { output, rest }
}

export const QWERTY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
