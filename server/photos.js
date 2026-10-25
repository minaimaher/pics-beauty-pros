// Demo portfolio photos from Pexels (free to use under the Pexels license, hotlinked from
// their CDN). Each entry is [Pexels photo id, caption].
export const pexelsSource = (id, w = 1200) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

// The GitHub Pages build downloads the photos at build time and serves them itself
// (scripts/fetch-photos.js); elsewhere they are loaded from Pexels directly.
const LOCAL_BASE = process.env.PBP_PHOTO_BASE;
export const pexels = (id, w = 1200) => (LOCAL_BASE ? `${LOCAL_BASE}/${id}-${w > 1200 ? 'xl' : 'md'}.jpg` : pexelsSource(id, w));

export const PORTFOLIOS = {
  'vendor@pbp.test': [
    [17057198, 'Through the viewfinder — first look'], [14355764, 'Golden hour under the bridge'], [13470038, 'Ballroom portraits'],
    [4942876, 'Desert session at sunset'], [18398510, 'Garden ceremony'], [2773498, 'Behind the scenes on a film shoot']
  ],
  'nour@pbp.test': [
    [20593111, 'Bridal base and contour'], [3813896, 'Soft glam application'], [3065170, 'Bridal updo'],
    [11083630, 'Ready for the aisle'], [8459411, 'Final touches'], [15130401, 'The kit']
  ],
  'sara@pbp.test': [
    [3065171, 'Event styling in the studio'], [8467969, 'Waves for a henna night'], [13212603, 'Braided crown'],
    [3065170, 'Classic chignon'], [2320890, 'Long-hair blowout']
  ],
  'alex@pbp.test': [
    [1556669, 'Maternity portrait'], [618923, 'Bump session'], [6856086, 'Red gown on the coast'],
    [6424638, 'Sheer gown maternity shoot'], [18649629, 'Newborn session'], [30654898, 'Sleeping newborn, basket set']
  ],
  'reel@pbp.test': [
    [29708266, 'Keynote coverage'], [29708258, 'Conference stage'], [31129059, 'Live audience moments'],
    [3928550, 'On the cinema rig'], [5314217, 'Street interviews'], [207716, 'Full-room wide shot']
  ],
  'mariam@pbp.test': [
    [15579920, 'Glossy editorial look'], [7944987, 'Skin-first glam'], [2661255, 'Natural luminous skin'],
    [247297, 'Rose lip, soft liner'], [1934780, 'Evening glam'], [19869152, 'Traditional bridal look']
  ],
  'vendor-sa@pbp.test': [
    [20178151, 'Glam look with hijab'], [35538623, 'Bride at the mirror'], [8467969, 'Henna-night waves'],
    [11083630, 'Wedding-night look'], [20593111, 'Bridal makeup in progress'], [2320890, 'Long-hair styling']
  ],
  'riyadhlens@pbp.test': [
    [30004322, 'Executive headshot'], [32113385, 'Beach wedding'], [18398510, 'Wedding portrait'],
    [29708260, 'Corporate event'], [320617, 'Studio setup'], [13470038, 'Couple portraits']
  ],
  'dune@pbp.test': [
    [4942876, 'Desert engagement film'], [2608519, 'On set'], [2848475, 'Cinema camera'],
    [14581845, 'Event filming'], [3928528, 'Run-and-gun coverage'], [14355764, 'Engagement stills']
  ],
  'coastal@pbp.test': [
    [247297, 'Graduation glam'], [2661255, 'Fresh natural look'], [20178151, 'Soft glam with hijab'],
    [7944987, 'Dewy skin'], [15130401, 'Products we use']
  ],
  'hala@pbp.test': [
    [13212603, 'Braids for the big day'], [3065171, 'Sleek finish'], [2320890, 'Volume blowout'],
    [8467969, 'Loose curls'], [3065170, 'Bridal updo']
  ],
  'fresh@pbp.test': [[15579920, 'Engagement look'], [2661255, 'Natural graduation makeup'], [3813896, 'In the chair']]
};

// Site imagery: home hero and category tiles.
export const SITE_PHOTOS = {
  hero: 4942876,
  photographer: 17057198,
  videographer: 2773498,
  makeup: 20593111,
  hair: 3065170
};

export const ALL_PHOTO_IDS = [...new Set([...Object.values(PORTFOLIOS).flat().map(([id]) => id), ...Object.values(SITE_PHOTOS)])];
