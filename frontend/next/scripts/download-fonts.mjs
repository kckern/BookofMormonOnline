// One-time helper: downloads RobotoCondensed and IBMPlexSansKR from Google Fonts
// into public/fonts/. Run with: npm run fonts
import { createWriteStream, mkdirSync } from 'fs'
import { pipeline } from 'stream/promises'
import { get } from 'https'

const DIR = new URL('../public/fonts/', import.meta.url).pathname
mkdirSync(DIR, { recursive: true })

const fonts = [
  {
    url: 'https://fonts.gstatic.com/s/robotocondensed/v31/ieVo2ZhZI2eCN5jzbjEETS9weq8-_d6T_POl0fRJeyVVpfBJ.ttf',
    file: 'RobotoCondensed-Bold.ttf',
  },
  {
    url: 'https://fonts.gstatic.com/s/robotocondensed/v31/ieVo2ZhZI2eCN5jzbjEETS9weq8-_d6T_POl0fRJeyXsovBJ.ttf',
    file: 'RobotoCondensed-Light.ttf',
  },
  {
    url: 'https://fonts.gstatic.com/s/ibmplexsanskr/v11/vEFK2-VJISZe3O_rc3ZVYh4aTwNO8tI.ttf',
    file: 'IBMPlexSansKR-Regular.ttf',
  },
]

for (const { url, file } of fonts) {
  const dest = DIR + file
  console.log(`Downloading ${file}...`)
  await new Promise((resolve, reject) =>
    get(url, (res) => {
      const ws = createWriteStream(dest)
      pipeline(res, ws).then(resolve).catch(reject)
    }).on('error', reject)
  )
  console.log(`  → ${dest}`)
}
console.log('Done.')
