/**
 * 代表视频 bvid 名单 —— 「播放最高的视频」板块的真实数据来源。
 *
 * 采集方式: 从 UP 主空间页的视频 Tab → 排序选「最多播放」,把播放量靠前的视频 BV 号复制到下面数组。
 * 展示方式: 前端每次用公开 view 接口实时拉取每个 bvid 的真实 标题/播放/点赞/投币,再按播放量排序展示。
 *
 * 说明: B站对「视频列表」接口(arc/search)风控极严,自动化无法抓取全量;
 *       但 view?bvid= 单条详情接口公开、免登录、风控宽松,故用「挑几条代表视频」的方式取真实数据。
 * 填入即生效(例如 'BV1xxxxxxxxxx')。
 */
export const featuredVideos: string[] = [
  'BV1F48Xz6Etx',
  'BV1sHKP6KEcy',
  'BV1knNj6hEaJ',
  'BV1pagg6tEwT',
  'BV1bRGF6UEZu',
  'BV1DjgG6jEZ4',
  'BV1A9N26HERL',
];
