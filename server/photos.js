// Demo photos from Pexels (free to use under the Pexels license). The GitHub Pages build
// downloads them and serves them itself (scripts/fetch-photos.js); elsewhere they are
// loaded from the Pexels CDN.
export const pexelsSource = (id, w = 1200) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const LOCAL_BASE = process.env.PBP_PHOTO_BASE;
export const pexels = (id, w = 1200) => (LOCAL_BASE ? `${LOCAL_BASE}/${id}-${w > 1200 ? 'xl' : 'md'}.jpg` : pexelsSource(id, w));

// Square, face-centred crop for profile photos.
export const avatarSource = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=400&h=400`;
export const avatar = (id) => (LOCAL_BASE ? `${LOCAL_BASE}/${id}-sq.jpg` : avatarSource(id));

// Themed photo pools: [Pexels id, caption].
export const POOLS = {
  wedding: [
    [17057198, 'Through the viewfinder — first look'], [14355764, 'Golden hour under the bridge'], [13470038, 'Ballroom portraits'],
    [4942876, 'Desert session at sunset'], [18398510, 'Garden ceremony'], [32113385, 'Beach wedding'], [1358841, 'Bride in lace'],
    [10673499, 'Veil silhouette'], [14819717, 'Bridal close-up'], [4545107, 'Soft-focus veil portrait'],
    [11055558, 'Groom getting ready'], [15663760, 'The groom'], [372176, 'Boutonniere detail'], [33492186, 'Hands at sunset'],
    [33337457, 'Golden-field engagement'], [13870508, 'Sunset silhouette']
  ],
  hijabBride: [
    [6141970, 'Bride in lace and hijab'], [13228483, 'Veil and smiles'], [19020843, 'Crown and henna'], [12898461, 'Traditional bridal look'],
    [21621602, 'Spiral staircase portrait']
  ],
  details: [
    [11309259, 'Rings by the bouquet'], [916344, 'Gold bands'], [10074702, 'Rings on the bouquet'], [37890462, 'Ring exchange'],
    [11626283, 'Blue bouquet'], [10074784, 'Under the veil'], [19075718, 'The ring'], [34597461, 'Reception tablescape'],
    [17022996, 'Floral venue'], [28976226, 'Outdoor reception']
  ],
  henna: [
    [34245192, 'Bridal henna'], [6197905, 'Henna and bangles'], [32029488, 'Henna detail'],
    [27164132, 'Couple henna'], [5467615, 'Henna-night look'], [1444441, 'Gold bangle and henna']
  ],
  makeupWork: [
    [20593111, 'Bridal base and contour'], [3813896, 'Soft glam application'], [7290112, 'Blending eyeshadow'], [7290668, 'Pink shimmer'],
    [7290732, 'Rose-toned lids'], [8214069, 'Setting under the eyes']
  ],
  makeupLooks: [
    [15579920, 'Glossy editorial look'], [7944987, 'Skin-first glam'], [2661255, 'Natural luminous skin'], [247297, 'Rose lip, soft liner'],
    [1934780, 'Evening glam'], [19869152, 'Traditional bridal look'], [20178151, 'Glam with hijab'], [7290125, 'Colour play'],
    [13121401, 'Graphic lid'], [4006692, 'Bronze smoky eye'], [7290749, 'Pastel eyes'], [11083630, 'Ready for the aisle'], [8459411, 'Final touches']
  ],
  kit: [
    [15130401, 'The kit'], [1327689, 'Palette of the week'], [7290674, 'On the table'], [7256160, 'Brushes and blush'], [4620873, 'Brush set'],
    [208052, 'Black palette'], [7290089, 'Prep station'], [7290611, 'Tools of the trade'], [11924085, 'Glow essentials']
  ],
  hair: [
    [3065170, 'Bridal updo'], [3065171, 'Event styling in the studio'], [3065209, 'Glamour curls'], [8467969, 'Soft waves'],
    [13212603, 'Braided crown'], [2320890, 'Long-hair blowout'], [10561323, 'Updo with roses'], [9941096, 'Bridal hair from behind'],
    [2995337, 'Floral updo'], [1900578, 'Sectioning for a style']
  ],
  video: [
    [2773498, 'Behind the scenes'], [2608519, 'On set'], [3928550, 'On the cinema rig'], [2848475, 'Cinema camera'], [5314217, 'Street interviews'],
    [3928528, 'Run-and-gun coverage'], [14581845, 'Event filming'], [32439172, 'Production day'], [30773261, 'Studio lighting'],
    [8088381, 'Camera operator'], [442587, 'Drone at sunset'], [10608125, 'Drone in flight']
  ],
  events: [
    [29708266, 'Keynote coverage'], [29708258, 'Conference stage'], [31129059, 'Live audience moments'], [29708260, 'Corporate event'],
    [207716, 'Full-room wide shot']
  ],
  maternity: [
    [1556669, 'Maternity portrait'], [618923, 'Bump session'], [6856086, 'Red gown on the coast'], [6424638, 'Sheer gown maternity shoot'],
    [30015965, 'Silhouette in profile']
  ],
  newborn: [[18649629, 'Newborn session'], [30654898, 'Sleeping newborn, basket set'], [19314791, 'Tiny details']],
  family: [
    [15427734, 'Family portrait'], [38472156, 'Birthday cake moment'], [8104206, 'Confetti party'], [34593866, 'Balloons everywhere'],
    [6148507, 'Cake time'], [35445912, 'Family celebration'], [27175484, 'First birthday']
  ],
  graduation: [
    [14723868, 'Graduation portrait'], [18885850, 'Cap and gown'], [2401206, 'Graduate with bouquets'], [16339930, 'Green gown portrait'],
    [5875778, 'Mortarboard close-up'], [6138266, 'Diploma day'], [2495237, 'Graduation joy']
  ],
  portrait: [
    [30004322, 'Executive headshot'], [320617, 'Studio setup'], [11761044, 'Location scouting'], [17099961, 'Portrait with camera'],
    [19552724, 'Black-and-white studio'], [5803235, 'Silhouette at dusk'], [2308773, 'Outdoor portrait'], [1546694, 'Street portrait']
  ]
};

// Which pools each demo vendor draws from, in order of preference.
const PLANS = {
  'vendor@pbp.test': ['wedding', 'details', 'video', 'hijabBride'],
  'nour@pbp.test': ['makeupWork', 'hijabBride', 'makeupLooks', 'hair', 'henna'],
  'sara@pbp.test': ['hair'],
  'alex@pbp.test': ['maternity', 'newborn', 'family'],
  'reel@pbp.test': ['events', 'video'],
  'mariam@pbp.test': ['makeupLooks', 'makeupWork', 'kit'],
  'vendor-sa@pbp.test': ['hijabBride', 'henna', 'makeupWork', 'hair'],
  'riyadhlens@pbp.test': ['portrait', 'wedding', 'events', 'graduation'],
  'dune@pbp.test': ['video', 'wedding'],
  'coastal@pbp.test': ['graduation', 'makeupLooks', 'kit'],
  'hala@pbp.test': ['hair', 'hijabBride'],
  'noor@pbp.test': ['hijabBride', 'wedding', 'details', 'family'],
  'saja@pbp.test': ['makeupLooks', 'makeupWork', 'hijabBride'],
  'mirage@pbp.test': ['events', 'video', 'portrait'],
  'reemhair@pbp.test': ['hair', 'hijabBride'],
  'goldenhour@pbp.test': ['graduation', 'portrait', 'family'],
  'corniche@pbp.test': ['wedding', 'video', 'details'],
  'danabridal@pbp.test': ['hijabBride', 'makeupWork', 'hair', 'henna'],
  'redsea@pbp.test': ['maternity', 'wedding', 'family'],
  'lulu@pbp.test': ['makeupLooks', 'kit', 'graduation'],
  'balad@pbp.test': ['video', 'wedding', 'events'],
  'zamalek@pbp.test': ['portrait', 'wedding', 'graduation'],
  'salma@pbp.test': ['makeupLooks', 'makeupWork', 'kit'],
  'maadi@pbp.test': ['hair'],
  'alexfilms@pbp.test': ['video', 'wedding', 'details'],
  'fresh@pbp.test': ['makeupLooks', 'graduation']
};

// Builds a vendor's portfolio: a few photos from each of its pools in turn, starting at a
// different point per vendor so vendors sharing a pool don't show identical galleries.
export function portfolioFor(email, count = 11) {
  const plan = PLANS[email];
  const offset = [...email].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const out = [];
  const seen = new Set();
  for (let round = 0; out.length < count && round < 20; round++) {
    for (const pool of plan) {
      const list = POOLS[pool];
      const item = list[(offset + round * 3) % list.length];
      if (!seen.has(item[0])) {
        seen.add(item[0]);
        out.push(item);
        if (out.length >= count) break;
      }
    }
  }
  return out;
}

// Profile photos of the people behind each demo business.
export const AVATARS = {
  'vendor@pbp.test': 14408918, // Hany — photographer holding a camera
  'nour@pbp.test': 8526806,
  'sara@pbp.test': 14269450,
  'alex@pbp.test': 1215443, // Youssef — with his DSLR
  'reel@pbp.test': 8241351,
  'mariam@pbp.test': 15520551,
  'vendor-sa@pbp.test': 19999995,
  'riyadhlens@pbp.test': 33853481,
  'dune@pbp.test': 5416864,
  'coastal@pbp.test': 36169798,
  'hala@pbp.test': 16865236,
  'noor@pbp.test': 14570936,
  'saja@pbp.test': 6530835,
  'mirage@pbp.test': 34171684,
  'reemhair@pbp.test': 15381147,
  'goldenhour@pbp.test': 7129611,
  'corniche@pbp.test': 36298150,
  'danabridal@pbp.test': 7822688,
  'redsea@pbp.test': 5416859,
  'lulu@pbp.test': 34739077,
  'balad@pbp.test': 17715910, // Hassan — behind the camera
  'zamalek@pbp.test': 7930942,
  'salma@pbp.test': 8155035,
  'maadi@pbp.test': 19959615,
  'alexfilms@pbp.test': 2449092,
  'fresh@pbp.test': 8070478
};

// Site imagery: home hero, category tiles and city tiles.
export const SITE_PHOTOS = {
  hero: 4942876,
  photographer: 17057198,
  videographer: 2773498,
  makeup: 20593111,
  hair: 3065170
};

export const CITY_PHOTOS = {
  Riyadh: 15839821,
  Jeddah: 29901876,
  Khobar: 19791633,
  Dammam: 19791633,
  Cairo: 20840204,
  Giza: 20840204,
  'New Cairo': 23314700,
  Alexandria: 30443925
};

export const ALL_PHOTO_IDS = [...new Set([
  ...Object.values(POOLS).flat().map(([id]) => id),
  ...Object.values(SITE_PHOTOS),
  ...Object.values(CITY_PHOTOS)
])];
export const AVATAR_IDS = [...new Set(Object.values(AVATARS))];
