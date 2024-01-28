const { PythonShell } = require("python-shell");
const express = require("express");
const app = express();
const cors = require("cors");
const { fs, vol } = require("memfs");
const realFs = require("fs");
const https = require("https");
const api_key = process.env.YAHOO_FINANCE_API_KEY;
const path = require("path");
const papa = require("papaparse");

app.use(cors());

const download = (url, dest, cb) => {
  var file = vol.createWriteStream(dest);

  var req = https
    .get(url, function (res) {
      res.pipe(file);
      file.on("finish", function () {
        file.close(cb(dest)); // close() is async, call cb after close completes.
      });
    })
    .on("error", function (err) {
      // Handle errors
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
    });
};

const getHistory = (interval, symbol, cb) => {
  const path = `/v8/finance/spark?interval=${interval}&range=max&symbols=${symbol}`;

  let body = "";

  const options = {
    host: "yfapi.net",
    path: path,
    headers: {
      Accept: "application/json",
      "x-api-key": `${api_key}`,
    },
  };
  const req = https.get(options, function (res) {
    res.setEncoding("utf8");
    res
      .on("data", function (chunk) {
        body = body.concat(chunk);
      })
      .on("end", () => {
        cb(body);
      })
      .on("error", function (e) {
        console.log("Got error: " + e.message);
      });
  });
};

app.get("/api/stock/bse", (request, response) => {
  let bseFinalJson = [];

  const getBseStocks = (dest) => {
    const file = realFs.readFileSync(
      path.join(__dirname, dest),
      "utf-8"
    );

    const bseStocks = papa.parse(file, { header: true });
    bseStocks.data.forEach((x) => {
      bseFinalJson = bseFinalJson.concat({
        label: x["Issuer Name"],
        value: x["Security Code"],
        exchange: "BSE",
      });
    });

    response.json(bseFinalJson);
    response.end();
  };
  getBseStocks("./bse_28_01_2024.csv");
});

app.get("/api/stock/nse", (request, response) => {
  let nseFinalJson = [];

  const getNseStocks = (dest) => {
    const re = /(?<=\n).*(?=,[A-Z]{2},)/g;
    const nseJson = vol.toJSON();
    const nseStocks = nseJson[dest].match(re);

    nseStocks.forEach((x) => {
      nseFinalJson = nseFinalJson.concat({
        label: x.split(",")[0],
        value: x.split(",")[1],
        exchange: "NSE",
      });
    });

    response.json(nseFinalJson);
    response.end();
  };
  download(
    "https://archives.nseindia.com/content/equities/EQUITY_L.csv",
    "/nse.csv",
    getNseStocks
  );
});

app.get(
  "/api/stock/predict/:symbol-:interval-:price-:no_of_candles",
  (request, response) => {
    const symbol = request.params.symbol;
    const interval = request.params.interval;
    const price = parseInt(request.params.price);
    const candles = parseInt(request.params.no_of_candles);

    const predict = (body) => {
      const close = { close: JSON.parse(body)[symbol].close };

      var spawn = require("child_process").spawn;
      var process = spawn("python3", [
        "./prediction_model.py",
        JSON.stringify(close),
        price,
        candles,
      ]);
      process.stdout.on("data", function (data) {
        response.status(200).send(JSON.parse(data.toString()));
        response.end();
      });
      process.on("error", (err) => {
        response.status(401).send("Unable to parse request.");
        console.log(`Error: ${err}`);
      });
    };

    // const predict = (body) => {

    //   const close = {"close": JSON.parse(body)[symbol].close}

    //   let options = {
    //     mode: 'json',
    //     pythonPath: 'python3',
    //     pythonOptions: ['-u'], // get print results in real-time
    //     args: [JSON.stringify(close), price, candles]
    //   };

    //   PythonShell.run('prediction_model.py', options, function (err, results) {
    //     if (err) throw err;
    //     response.send(results)
    //     response.end()
    //   });

    // }

    getHistory(interval, symbol, predict);
  }
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
