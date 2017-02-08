const express = require('express');
const Http = require('node-rest-client').Client;

const {exchanges, properties} = require('./exchanges.json');

const app = express();

const port = process.env.PORT || 3000;

const promisesCache = {};

app.listen(port, () => {
  console.log('App now running on port ', port);
});

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Generic error handler used by all endpoints.
function handleError(res, error) {
  res.status(200).json({
    success: false,
    error
  });
}

function handleSuccess(res, data) {
  res.status(200).json({
    success: true,
    data
  });
}

function unifyData(exchange, data) {
  let ticker = {};
  let toFloat = (exchanges[exchange].flags || []).indexOf('FLOAT_CONVERT') !== -1;
  properties.map((key, i) => {
    let prop = exchanges[exchange].prop[i];
    if (prop !== null) ticker[key] = toFloat ? parseFloat(data[prop]) : data[prop];
  });
  let missing = properties.filter((prop, i) => exchanges[exchange].prop[i] === null);
  return {ticker, missing};
}

function getCodes(from, to) {
  let [FROM, TO] = [from, to].map(str => str.toUpperCase());
  return {from, to, FROM, TO};
}

function getUrl(urlTpl, codes) {
  return Object.keys(codes).reduce((url, code) => {
    return url.replace(`%${code}%`, codes[code]);
  }, urlTpl);
};

function getResult(codes) {
  let http = new Http();
  let requestDate = new Date();
  let requestedExchanges = Object.keys(exchanges).filter(key => {
    let markets = exchanges[key].markets;
    return markets.indexOf(codes.from) !== -1 && markets.indexOf(codes.to) !== -1;
  });

  let promises = requestedExchanges.map(exchange => {
    let url = getUrl(exchanges[exchange].urlTpl, codes);
    if (url in promisesCache) {
      return promisesCache[url];
    }
    promisesCache[url] = new Promise((resolve, reject) => {
      http.get(url, data => {
        let unified = unifyData(exchange, data);
        unified.timestamp = {
          request: +requestDate,
          response: +new Date()
        };
        resolve(unified);
        // remove it after 1 sec
        setTimeout(() => delete promisesCache[url]);
      });
    });
    return promisesCache[url];
  });
  return new Promise((resolve, reject) => {
    Promise.all(promises).then(arr => {
      let res = {};
      requestedExchanges.map((exchange, i) => res[exchange] = arr[i]);
      resolve(res);
    });
  });
}


// routes:

// PLN markets:
app.get('/ticker/btcpln', (res, req) => {
  getResult(getCodes('btc', 'pln')).then(res => handleSuccess(req, res));
});

app.get('/ticker/ethpln', (res, req) => {
  getResult(getCodes('eth', 'pln')).then(res => handleSuccess(req, res));
});

app.get('/ticker/ltcpln', (res, req) => {
  getResult(getCodes('ltc', 'pln')).then(res => handleSuccess(req, res));
});

// EUR markets:
app.get('/ticker/btceur', (res, req) => {
  getResult(getCodes('btc', 'eur')).then(res => handleSuccess(req, res));
});

app.get('/ticker/etheur', (res, req) => {
  getResult(getCodes('eth', 'eur')).then(res => handleSuccess(req, res));
});


app.get('/exchanges', (res, req) => {
  handleSuccess(req, Object.keys(exchanges));
});

app.get('/markets', (res, req) => {
  let data = {};
  Object.keys(exchanges).map(exchange => (data[exchange] = {
    markets: exchanges[exchange].markets
  }));
  handleSuccess(req, data);
});

// catch all
app.use((req, res) => {
  handleError(res, 'unknown method');
});
