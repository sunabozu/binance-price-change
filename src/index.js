/* eslint-disable no-console */
// const logger = require('winston');
const { createLogger, format, transports } = require('winston')
const { combine, timestamp, label, printf } = format
const myFormat = printf(info => {
  return `[${info.timestamp}] ${info.level}: ${info.message}`;
})

const logger = createLogger({
  format: combine(
    timestamp(),
    format.splat(),
    myFormat
  ),
  transports: [new transports.Console()]
})

// const app = require('./app');
// const port = app.get('port');
// const server = app.listen(port);

// server.on('listening', () =>
//   logger.info('Feathers application started on http://%s:%d', app.get('host'), port)
// );

const url = require('url')
const http = require('http')
const app = http.createServer((request, response) => {
  const query = url.parse(request.url, true).query
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write('This is a test page. Carry on.');
  response.end();
})

app.listen(8080, '0.0.0.0')

// my binance stuff
const Binance = require('binance-api-node').default
const request = require('request-promise-native')
let { BINANCE_KEY, BINANCE_SECRET, PUSHED_KEY, PUSHED_SECRET } = process.env

// import keys manually, if it's not production
if(!BINANCE_KEY) {
  console.log(`The keys are absent, trying to get them from a file...`)
  now_keys = require('../env.json').env
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

const prices = []
const interval = 20000
const changeTime = 60000 * 60 //300000
const elementsInterval = changeTime / interval
let lastPush = null // new Date().getTime()

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

    // make sure we have enough data to analize
    // if(prices.length < elementsInterval)
    //   return
    
    // const firstRelevantPrice = prices[prices.length - elementsInterval + 1]
    // const delta = prices[prices.length - 1] - firstRelevantPrice
    // // console.log('delta: ' + delta)

    // // we're only interested in negative changes
    // if(delta >= 0)
    //   return
    
    // const relativeChange = delta * -1 / firstRelevantPrice * 100
    // console.log(`The prices dropped by ${relativeChange.toFixed(3)}%`)

    // // the change should be significant enough
    // if(relativeChange < 0.6)
    //   return

    

    // find the highest price in this period
    const topPrice = Math.max(...prices)
    

    const delta = topPrice - lastPrice
    console.log(`Top price: ${topPrice}, last price: ${lastPrice}, delta: ${delta}, array length: ${prices.length}`)

    if(delta < 29)
      return
    
    // console.log('😈😈😈 We got a big drop here, placing an order 😈😈😈')
    // bclient.order({
    //   symbol: 'BTCUSDT',
    //   side: 'BUY',
    //   quantity: 0.014,
    //   price: lastPrice - 5
    // })
    // .then(resp => {
    //   if(resp.status == 'NEW') {
    //     console.log('The order is placed!')
    //   }
    // })


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
      logger.error(err)
    })
  })
  .catch(err => {
    logger.info(err)
  })
}, interval)