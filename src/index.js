const express = require('express');
const Http = require('node-rest-client').Client;

const {markets, properties} = require('./markets.json');

const app = express();

const port = process.env.PORT || 3000;

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

function unifyData(market, data) {
  let ticker = {};
  let toFloat = (markets[market].flags || []).indexOf('FLOAT_CONVERT') !== -1;
  properties.map((key, i) => {
    let prop = markets[market].prop[i];
    if (prop !== null) ticker[key] = toFloat ? parseFloat(data[prop]) : data[prop];
  });
  let missing = properties.filter((prop, i) => markets[market].prop[i] === null);
  return {ticker, missing};
}

// routes:

app.get('/ticker/btcpln', (res, req) => {  
  let http = new Http();
  let promises = Object.keys(markets).map(market => {
    return new Promise((resolve, reject) => http.get(markets[market].url, resolve));
  });
  Promise.all(promises).then(arr => {
    let res = {};
    Object.keys(markets).map((market, i) => {
      res[market] = unifyData(market, arr[i]);
    });
    handleSuccess(req, res);
  });
});

app.get('/exchanges', (res, req) => {  
  handleSuccess(req, Object.keys(markets));
});

// catch all
app.use((req, res) => {
  handleError(res, 'unknown method');
});
