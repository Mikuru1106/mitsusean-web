export const profile = {
  name: '水聖安',
  nameJP: 'Mizusean',
  //emoji: '💧',
  /** B站账号 mid,数据观测与头像均以此为准 */
  mid: 431115683,
  /** B站真实头像(2026-08-29 取自 card 接口 face 字段) */
  avatar:
    'https://i2.hdslb.com/bfs/face/0da9945a3550ac3d3491814a85c83fa5f09e9e9b.jpg',
  banner: '',
  bio: '泥豪人类！天天开心哦¯꒳¯',
  longBio: `这里是水聖安的非官方应援站 ✨

她的声音像清泉流过心间，既有水的温柔，也有圣洁的力量。
每一首歌都是一次心灵的旅行，每一个音符都承载着真挚的情感。

本站由喜爱水聖安的粉丝创建与维护，汇总了她的歌曲切片、社交链接与相关资讯。
希望能让更多人认识这位闪闪发光的歌者。`,
  social: {
    bilibili: { url: 'https://space.bilibili.com/431115683', label: 'B站主页' },
    douyin: { url: 'https://v.douyin.com/BsGmAUJlMF8/', label: '抖音' },
    qq: { url: '#', label: 'QQ群' },
    mihuashi: { url: 'https://www.mihuashi.com/profiles/4102064', label: '米画师' },
  },
};

export type SongCategory = '翻唱' | '歌回切片';

export interface Song {
  id: string;
  title: string;
  category: SongCategory;
  thumbnail: string;
  bvid: string;
  url: string;
  date: string;
  desc: string;
  /** 演示数据:接入数据快照后由观测舱统一提供 */
  plays: number;
  likes: number;
  coins: number;
}

export const songCategories: Array<'全部' | SongCategory> = ['全部', '翻唱', '歌回切片'];

export const songs: Song[] = [
  {
    id: 'cover-1',
    title: "唱了re0的歌🎶",
    category: '翻唱',
    thumbnail: '/images/cover-bv1bqbn6wejt.jpg',
    bvid: 'BV1BqbN6WEjT',
    url: 'https://www.bilibili.com/video/BV1BqbN6WEjT',
    date: '2026-09-07',
    desc: "唱了re0的歌🎶",
    plays: 3760,
    likes: 1260,
    coins: 162,
  },
  {
    id: 'cover-2',
    title: "唱唱🎶",
    category: '翻唱',
    thumbnail: '/images/cover-bv14gbw6weza.jpg',
    bvid: 'BV14GbW6WEZA',
    url: 'https://www.bilibili.com/video/BV14GbW6WEZA',
    date: '2026-09-06',
    desc: "唱唱🎶",
    plays: 4208,
    likes: 1828,
    coins: 223,
  },
  {
    id: 'cover-3',
    title: "喝多了就这样跑调",
    category: '翻唱',
    thumbnail: '/images/cover-bv16lyrbbenw.jpg',
    bvid: 'BV16LyrBbEnw',
    url: 'https://www.bilibili.com/video/BV16LyrBbEnw',
    date: '2025-10-28',
    desc: "喝多了就这样跑调",
    plays: 1744,
    likes: 212,
    coins: 44,
  },
  {
    id: 'cover-4',
    title: "遠い記憶、花束の赤 feat. *染/一小段弹唱。",
    category: '翻唱',
    thumbnail: '/images/cover-bv1gbvkz5ef4.jpg',
    bvid: 'BV1GBvKz5Ef4',
    url: 'https://www.bilibili.com/video/BV1GBvKz5Ef4',
    date: '2025-08-27',
    desc: "晚安噜(。´▽`。)",
    plays: 2180,
    likes: 309,
    coins: 53,
  },
  {
    id: 'cover-5',
    title: "踊り子/一小段弹唱。",
    category: '翻唱',
    thumbnail: '/images/cover-bv1pbbczeesn.jpg',
    bvid: 'BV1pBbCzEEsn',
    url: 'https://www.bilibili.com/video/BV1pBbCzEEsn',
    date: '2025-07-24',
    desc: "-",
    plays: 4724,
    likes: 883,
    coins: 112,
  },
  {
    id: 'cover-6',
    title: "チチンプイプイ/弹唱。",
    category: '翻唱',
    thumbnail: '/images/cover-bv12akazsext.jpg',
    bvid: 'BV12aKAzSEXT',
    url: 'https://www.bilibili.com/video/BV12aKAzSEXT',
    date: '2025-06-20',
    desc: "-",
    plays: 2624,
    likes: 333,
    coins: 49,
  },
  {
    id: 'cover-7',
    title: "ミカヅキ/弹唱。",
    category: '翻唱',
    thumbnail: '/images/cover-bv1janizrepu.jpg',
    bvid: 'BV1jANizREPU',
    url: 'https://www.bilibili.com/video/BV1jANizREPU',
    date: '2025-06-17',
    desc: "-",
    plays: 2617,
    likes: 349,
    coins: 63,
  },
  {
    id: 'cover-8',
    title: "ヒッチコック/弹唱。",
    category: '翻唱',
    thumbnail: '/images/cover-bv17xj2zhefr.jpg',
    bvid: 'BV17Xj2zHEFR',
    url: 'https://www.bilibili.com/video/BV17Xj2zHEFR',
    date: '2025-05-26',
    desc: "-",
    plays: 2297,
    likes: 230,
    coins: 45,
  },
  {
    id: 'cover-9',
    title: "iloveyouso",
    category: '翻唱',
    thumbnail: '/images/cover-bv1nttyzteyu.jpg',
    bvid: 'BV1ntTyztEYu',
    url: 'https://www.bilibili.com/video/BV1ntTyztEYu',
    date: '2025-06-07',
    desc: "家里的老鼠突然出来唱了歌",
    plays: 3689,
    likes: 488,
    coins: 72,
  },
  {
    id: 'cover-10',
    title: "想成为你的太阳/弹唱。",
    category: '翻唱',
    thumbnail: '/images/cover-bv12uo1yxe7f.jpg',
    bvid: 'BV12uo1YXE7f',
    url: 'https://www.bilibili.com/video/BV12uo1YXE7f',
    date: '2025-03-24',
    desc: "-",
    plays: 2586,
    likes: 170,
    coins: 48,
  },
  {
    id: 'cover-11',
    title: "翻唱/浮気されたけどまだ好きって曲。（关于就算被劈腿了也喜欢你的歌。）",
    category: '翻唱',
    thumbnail: '/images/cover-bv1j3ojyfe4u.jpg',
    bvid: 'BV1J3ojYfE4u',
    url: 'https://www.bilibili.com/video/BV1J3ojYfE4u',
    date: '2025-04-14',
    desc: "-",
    plays: 2228,
    likes: 148,
    coins: 41,
  },
  {
    id: 'cover-12',
    title: "25.11.4.11:50",
    category: '翻唱',
    thumbnail: '/images/cover-bv1lx1zbje2y.jpg',
    bvid: 'BV1LX1zBJE2y',
    url: 'https://www.bilibili.com/video/BV1LX1zBJE2y',
    date: '2025-11-04',
    desc: "-",
    plays: 2216,
    likes: 306,
    coins: 68,
  },
  {
    id: 'cover-13',
    title: "カワキヲアメク/弹唱。",
    category: '翻唱',
    thumbnail: '/images/cover-bv1mushb9eti.jpg',
    bvid: 'BV1mUShB9ETi',
    url: 'https://www.bilibili.com/video/BV1mUShB9ETi',
    date: '2025-12-03',
    desc: "-",
    plays: 2894,
    likes: 385,
    coins: 91,
  },
  {
    id: 'cover-14',
    title: '拙劣的唱了「好きだから。」',
    category: '翻唱',
    thumbnail: '/images/cover-bv1mjzebqeme.jpg',
    bvid: 'BV1mjZeBQEmE',
    url: 'https://www.bilibili.com/video/BV1mjZeBQEmE',
    date: '2026-02-19',
    desc: '我唱的好难听寸不己TT',
    plays: 33848,
    likes: 15609,
    coins: 753,
  },
  {
    id: 'cover-15',
    title: '唱唱',
    category: '翻唱',
    thumbnail: '/images/cover-bv18jfmbde4n.jpg',
    bvid: 'BV18jfMBDE4n',
    url: 'https://www.bilibili.com/video/BV18jfMBDE4n',
    date: '2026-02-23',
    desc: '-',
    plays: 30001,
    likes: 12334,
    coins: 563,
  },

  {
    id: '4',
    title: '【水聖安|清唱切片】あなたは煙草/ただ君に晴れ/可爱动静',
    category: '歌回切片',
    thumbnail: '/images/song-bv1cxvf6qezw.jpg',
    bvid: 'BV1cxVf6qEzw',
    url: 'https://www.bilibili.com/video/BV1cxVf6qEzw',
    date: '2026-06-02',
    desc: `关注小安喵~关注小安谢谢喵~
不会特效字幕摆了
【B站】https://space.bilibili.com/431115683
【直播间】https://live.bilibili.com/23639188`,
    plays: 116,
    likes: 8,
    coins: 2,
  },
  {
    id: '7',
    title: '【水聖安|清唱切片】好きだから/月が綺麗ねと言われたい/ヒッチコック/天才小安成功学会弹反铃珠猎人',
    category: '歌回切片',
    thumbnail: '/images/song-bv1by3m6ledh.jpg',
    bvid: 'BV1bY3m6LEDh',
    url: 'https://www.bilibili.com/video/BV1bY3m6LEDh',
    date: '2026-08-02',
    desc: `关注小安喵~关注小安谢谢喵~
不会粒子效果摆了
【B站】https://space.bilibili.com/431115683
【直播间】https://live.bilibili.com/23639188`,
    plays: 186,
    likes: 9,
    coins: 2,
  }
];

export const navLinks = [
  { label: '首页', path: '#hero' },
  { label: 'Room', path: '#about' },
  { label: '歌曲切片', path: '#songs' },
  { label: '数据观测', path: '#observatory' },
  { label: '抽奖机', path: '#lottery' },
];

export interface Track {
  title: string;
  artist: string;
  /** B站 MV 稿件(音频经 dev 中间件转发播放) */
  bvid: string;
  /** 可选的静态音频文件；不存在时由播放器回退到 B站代理 */
  audioSrc?: string;
  /** 可选的站内 LRC 文件；配置后优先于在线歌词库 */
  lyrics?: string;
}

/** 首页音乐卡片:点击切换;歌词优先读取站内 LRC,否则从 LRCLIB 获取 */
export const tracks: Track[] = [
  { title: 'ヒッチコック', artist: 'ヨルシカ', bvid: 'BV1CW411K7Rn', audioSrc: '/audio/BV1CW411K7Rn.m4a' },
  { title: '言って。', artist: 'ヨルシカ', bvid: 'BV19x41167us', audioSrc: '/audio/BV19x41167us.m4a' },
  { title: 'ただ君に晴れ', artist: 'ヨルシカ', bvid: 'BV1dW41137on', audioSrc: '/audio/BV1dW41137on.m4a' },
  { title: '溶けた声で', artist: 'culicc_', bvid: 'BV1cm411U7vi', audioSrc: '/audio/BV1cm411U7vi.m4a', lyrics: '/lyrics/toketa-koe.lrc' },
  { title: '好きだから。', artist: '『ユイカ』', bvid: 'BV1cL411W7Kz', audioSrc: '/audio/BV1cL411W7Kz.m4a' },
];
