import dotenv from 'dotenv'

dotenv.config({ path: new URL('./.env', import.meta.url) })

import app from './app.js'

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})
