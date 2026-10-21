/** デバッグ用の機能（一手戻る）を出すか：開発サーバー、または URL に ?debug を付けたとき */
export const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')
