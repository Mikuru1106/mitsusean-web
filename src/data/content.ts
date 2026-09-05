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

export type SongCategory = '翻唱' | '歌回切片' | '合唱';

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

export const songCategories: Array<'全部' | SongCategory> = ['全部', '翻唱', '歌回切片', '合唱'];

export const songs: Song[] = [
  {
    id: '1',
    title: '【翻唱】アイドル - YOASOBI',
    category: '翻唱',
    thumbnail: '',
    bvid: '',
    url: 'https://space.bilibili.com/431115683',
    date: '2026-07',
    desc: '充满力量感的高音，水聖安版的アイドル让人耳目一新',
    plays: 382000,
    likes: 24600,
    coins: 11800,
  },
  {
    id: '2',
    title: '【翻唱】夜に駆ける - YOASOBI',
    category: '翻唱',
    thumbnail: '',
    bvid: '',
    url: 'https://space.bilibili.com/431115683',
    date: '2026-06',
    desc: '温柔与爆发力完美结合的一首翻唱',
    plays: 264000,
    likes: 17300,
    coins: 8600,
  },
  {
    id: '3',
    title: '【翻唱】可愛くてごめん',
    category: '翻唱',
    thumbnail: '',
    bvid: '',
    url: 'https://space.bilibili.com/431115683',
    date: '2026-05',
    desc: '超可爱的一首歌！水聖安的声音甜度满分',
    plays: 198000,
    likes: 15400,
    coins: 9200,
  },
  {
    id: '4',
    title: '【歌回切片】深夜治愈歌单',
    category: '歌回切片',
    thumbnail: '',
    bvid: '',
    url: 'https://space.bilibili.com/431115683',
    date: '2026-04',
    desc: '一个小时的温柔歌回，每首都好听',
    plays: 156000,
    likes: 9800,
    coins: 5100,
  },
  {
    id: '5',
    title: '【翻唱】新時代 - Ado',
    category: '翻唱',
    thumbnail: '',
    bvid: '',
    url: 'https://space.bilibili.com/431115683',
    date: '2026-03',
    desc: '高难度曲目完美驾驭，展现超强唱功',
    plays: 143000,
    likes: 10200,
    coins: 4700,
  },
  {
    id: '6',
    title: '【合唱】打上花火 with 嘉宾',
    category: '合唱',
    thumbnail: '',
    bvid: '',
    url: 'https://space.bilibili.com/431115683',
    date: '2026-02',
    desc: '绝美和声，两人声音的化学反应太棒了',
    plays: 121000,
    likes: 8100,
    coins: 3900,
  },
  {
    id: '7',
    title: '【歌回切片】雨夜点歌回',
    category: '歌回切片',
    thumbnail: '',
    bvid: '',
    url: 'https://space.bilibili.com/431115683',
    date: '2026-01',
    desc: '伴着雨声的抒情串烧，氛围感拉满',
    plays: 97000,
    likes: 6400,
    coins: 3100,
  },
];

export interface Milestone {
  date: string;
  type: '首播' | '爆款' | '万粉' | '周年' | '纪念';
  title: string;
  desc: string;
  emoji: string;
}

export const milestones: Milestone[] = [
  {
    date: '2025-08-08',
    type: '首播',
    title: '初次见面，我是水聖安',
    desc: '出道首播，一曲《打上花火》让「水」这个名字第一次流进大家的耳朵。',
    emoji: '💧',
  },
  {
    date: '2025-12-24',
    type: '纪念',
    title: '平安夜特别歌回',
    desc: '连续三小时的温柔歌回，同时在线人数创下当时的纪录。',
    emoji: '🎄',
  },
  {
    date: '2026-03-14',
    type: '爆款',
    title: '《アイドル》切片出圈',
    desc: '充满力量感的高音被剪成切片后爆火，单条播放突破 30 万。',
    emoji: '🔥',
  },
  {
    date: '2026-04-26',
    type: '万粉',
    title: '粉丝突破 1 万',
    desc: '从第一滴水的回响，到一片温柔的海。谢谢每一个你。',
    emoji: '🌊',
  },
  {
    date: '2026-08-08',
    type: '周年',
    title: '出道一周年纪念回',
    desc: '一周年纪念直播，翻唱了评论区点播最多的十首歌。',
    emoji: '🎂',
  },
];

export const navLinks = [
  { label: '首页', path: '#hero' },
  { label: '关于', path: '#about' },
  { label: '歌曲切片', path: '#songs' },
  { label: '数据观测', path: '#observatory' },
  { label: '里程碑', path: '#milestones' },
];

export interface Track {
  title: string;
  artist: string;
  /** B站 MV 稿件(音频经 dev 中间件转发播放) */
  bvid: string;
}

/** 首页音乐卡片:点击切换;歌词由 useLrc 运行时从 LRCLIB 获取,不在代码中存放歌词文本 */
export const tracks: Track[] = [
  { title: 'ヒッチコック', artist: 'ヨルシカ', bvid: 'BV1CW411K7Rn' },
  { title: '言って。', artist: 'ヨルシカ', bvid: 'BV19x41167us' },
];
