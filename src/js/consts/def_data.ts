/** 汎用フォント */
export const FONT_COMMON = "'Helvetica Neue', 'Helvetica', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Arial', 'Yu Gothic', 'Meiryo', sans-serif"
/** 寿司フォント */
export const FONT_SUSHI = "'Times New Roman', 'YuMincho', 'Hiragino Mincho ProN', 'Yu Mincho', 'MS PMincho', serif"

/**
* 結果 (正解率の降順)
* 正解率,判子の格付け,メッセージ,サウンド
*/
export const RESULT_INFO: [number, string, string, string][] = [
  [100, '特上', '大変よくできました', 'fanfare'],
  [70, '上', 'よくできました', 'fanfare'],
  [40, '並', 'もう少しです', 'gameover'],
  [0, '修行中', 'がんばりましょう', 'gameover'],
]

/** 画像リスト */
export const LST_IMAGES = [
  ['kuman', 'ku_man.svg'],
  ['kuman_ok', 'ku_man_ok.svg'],
  ['kuman_ng', 'ku_man_ng.svg'],
  ['boushi', 'boushi.svg'],
  ['table', 'table.svg'],
  ['ans_ok', 'ans_ok.svg'],
  ['ans_ng', 'ans_ng.svg'],
]

/** 音声リスト */
export const LST_AUDIOS = [
  ['start', 'bgm_coinin_2'],
  ['gameover', 'bgm_gameover_1'],
  ['fanfare', 'bgm_fanfare_1'],
  ['seikai', 'se_quizright_1'],
  ['miss', 'se_quizmistake_1'],
]
