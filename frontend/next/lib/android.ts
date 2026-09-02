export const ANDROID_PACKAGE_NAME = 'online.bookofmormon.twa'

// Google Play app-signing certificate, recovered from generated APK metadata
// for the existing version-code 2 bundle. This is intentionally the Play
// app-signing certificate, not the replaceable upload-key certificate.
export const ANDROID_APP_SIGNING_SHA256 =
  'AA:03:3F:59:4A:10:FB:EE:19:75:6D:5A:D9:6F:FF:92:49:A5:50:B4:A5:5B:96:33:0F:13:D2:09:BB:13:BF:A0'

export const PWA_MANIFEST = {
  id: '/',
  name: 'Book of Mormon Online',
  short_name: 'BkMrmn',
  description:
    'A dynamic, social study resource for all students of the Book of Mormon',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  orientation: 'portrait-primary',
  background_color: '#323b4d',
  theme_color: '#000000',
  categories: ['books', 'education', 'reference', 'religion'],
  lang: 'en',
  dir: 'ltr',
  icons: [
    {
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-192-maskable.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  shortcuts: [
    { name: 'Read', short_name: 'Read', url: '/read' },
    { name: 'Study', short_name: 'Study', url: '/study' },
    { name: 'People', short_name: 'People', url: '/people' },
    { name: 'Theater', short_name: 'Theater', url: '/theater' },
  ],
  iarc_rating_id: 'e84b072d-71b3-4d3e-86ae-31a8ce4e53b7',
  prefer_related_applications: false,
  related_applications: [],
} as const

export const ANDROID_ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE_NAME,
      sha256_cert_fingerprints: [ANDROID_APP_SIGNING_SHA256],
    },
  },
] as const

