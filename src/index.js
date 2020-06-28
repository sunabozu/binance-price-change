/* eslint-disable no-console */


// my binance stuff
const Binance = require('binance-api-node').default
const request = require('request-promise-native')
let { BINANCE_KEY, BINANCE_SECRET, PUSHED_KEY, PUSHED_SECRET, FIREBASE_KEY } = process.env

// import keys manually, if it's not production
if(!BINANCE_KEY) {
  console.log(`The keys are absent, trying to get them from a file...`)
  now_keys = require('../../env.json').env
  BINANCE_KEY = now_keys.binance_key
  BINANCE_SECRET = now_keys.binance_secret
  PUSHED_KEY = now_keys.pushed_key
  PUSHED_SECRET = now_keys.pushed_secret
}

// create a new client
const bclient = Binance({
  apiKey: BINANCE_KEY,
  apiSecret: BINANCE_SECRET
})

// local database
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('../db.json')
const db = low(adapter)

const prices = []
const interval = 20000
const changeTime = 60000 * 60 //300000
const elementsInterval = changeTime / interval
let lastPush = null // new Date().getTime()
let DELTA = 189 // default

// get the delta from file
// db.set('settings.delta', 1488).write()
const settings = db.get('settings').value()

if(settings && settings.delta) {
  DELTA = settings.delta
}
console.log(db.get('settings').value())

setInterval(() => {
  //console.log('fetching prices...')
  bclient.prices()
  .then(resp => {
    // a strange binance glitch
    if(!resp.BTCUSDT)
      return
    
    const lastPrice = parseFloat(resp.BTCUSDT)
    prices.push(lastPrice)

    // keep it limited to 30 elements (i.e. 10 minutes)
    if(prices.length > elementsInterval) {
      
      prices.shift()
    }

    // find the highest price in this period
    const topPrice = Math.max(...prices)
    

    const delta = topPrice - lastPrice
    console.log(`Top price: ${topPrice}, last price: ${lastPrice}, delta: ${delta}, array length: ${prices.length}`)

    if(delta < DELTA)
      return

    // check if already pushed recently
    console.log('push difference: ', new Date().getTime() - lastPush, changeTime)
    console.log('last push: ', lastPush)
    if(lastPush && new Date() - lastPush < changeTime) {
      console.log('Skip. Already pushed recently.')
      return
    }

    // record the push time
    lastPush = new Date().getTime()

    console.log('PUSH')

    // send a push notification
    request.post({
      url: 'https://api.pushed.co/1/push',
      form: {
        app_key: PUSHED_KEY,
        app_secret: PUSHED_SECRET,
        target_type: 'app',
        content: `🔥 Bitcoin dropped by $${delta.toFixed(2)} to $${lastPrice.toFixed(0)} in the past ${changeTime / 60000} minute(s)! 🔥`,
      }
    })
    .then(resp => {
      console.log('Pushed successfully') 
    })
    .catch(err => {
      console.log(err)
    })
  })
  .catch(err => {
    console.log(err)
  })
}, interval)


const express = require('express')
const app = express()
app.use(express.urlencoded())

app.get('/', (req, res) => {
  res.send(`
  <html>
    <body>
      <form method="post" action="/update">
        Delta: <input type="text" name="delta" value="${DELTA}" focused />
        <input type="submit" value="save" />
      </form>
    </body>
  </html>
  `)
})

app.post('/update', (req, res) => {
  console.log(req.body)
  if(req.body.delta) {
    try {
      DELTA = parseInt(req.body.delta)
      db.set('settings.delta', DELTA).write()
    } catch(e) {
      console.log(e)
    }
  }
  res.redirect('/')
})

app.listen(8080, '0.0.0.0')