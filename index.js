const { PythonShell } = require('python-shell')
const express = require('express')
const app = express()
const cors = require('cors')
const { fs, vol } = require('memfs')
const https = require('https')
const api_key = process.env.YAHOO_FINANCE_API_KEY

app.use(cors())

const download = (url, dest, cb) => {
  var file = vol.createWriteStream(dest);

  var req = https.get(url, function(res) {
      res.pipe(file);
      file.on('finish', function() {
        file.close(cb(dest));  // close() is async, call cb after close completes.
      });
    }).on('error', function(err) { // Handle errors
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
    });
};

const getHistory = (interval, symbol, cb) => {

  const path = `/v8/finance/spark?interval=${interval}&range=max&symbols=${symbol}`

  let body = ''

  const options = {
    host: 'yfapi.net',
    path: path,
    headers: {
      'Accept': 'application/json',
      'x-api-key': `${api_key}`
    }
  };
  const req = https.get(options, function (res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      body = body.concat(chunk)
    }).on('end', () => {
      cb(body)
    }).on('error', function(e) {
      console.log("Got error: " + e.message);
    });
  })
}

app.get('/api/stock/bse', (request, response) => {

  let bseFinalJson = []

  const getBseStocks = (dest) => {
    const re = /(?<=\d{6},).*(?=,.*,Active)/g;
    const bseJson = vol.toJSON()
    const bseStocks = bseJson[dest].match(re)
    bseStocks.forEach(x => {
        if(x[0] === '"')
          bseFinalJson = bseFinalJson.concat({label: x.split(",")[2], value: x.split(",")[0].slice(1,), exchange: 'BSE'})
        else
          bseFinalJson = bseFinalJson.concat({label: x.split(",")[1], value: x.split(",")[0], exchange: 'BSE'})
      }
    )
    response.json(bseFinalJson)
    response.end()
  }
  download('https://api.bseindia.com/BseIndiaAPI/api/LitsOfScripCSVDownload/w?segment=Equity&status=Active', '/bse.csv', getBseStocks)
})

app.get('/api/stock/nse', (request, response) => {

  let nseFinalJson = []

  const getNseStocks = (dest) => {
    const re = /(?<=\n).*(?=,[A-Z]{2},)/g;
    const nseJson = vol.toJSON()
    const nseStocks = nseJson[dest].match(re)
    nseStocks.forEach(x => {
        nseFinalJson = nseFinalJson.concat( {label: x.split(",")[0], value: x.split(",")[1], exchange: 'NSE'} )
      }
    )
    response.json(nseFinalJson)
    response.end()
  }
  download('https://archives.nseindia.com/content/equities/EQUITY_L.csv', '/nse.csv', getNseStocks)
})

app.get('/api/stock/predict/:symbol-:interval-:price-:no_of_candles', (request, response) => {

  const symbol = request.params.symbol
  const interval = request.params.interval
  const price = parseInt(request.params.price)
  const candles = parseInt(request.params.no_of_candles)

  const predict = (body) => {

    const close = {"close": JSON.parse(body)[symbol].close}

    let options = {
      mode: 'json',
      pythonPath: 'python3',
      pythonOptions: ['-u'], // get print results in real-time
      args: [JSON.stringify(close), price, candles]
    };

    PythonShell.run('prediction_model.py', options, function (err, results) {
      if (err) throw err;
      response.send(results)
      response.end()
    });

  }

  getHistory(interval, symbol, predict)

})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})