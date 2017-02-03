const express = require('express');
const Http = require('node-rest-client').Client;

const {exchanges, properties} = require('./markets.json');

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

// routes:

app.get('/ticker/btcpln', (res, req) => {  
  let http = new Http();
  let requestDate = new Date();
  let promises = Object.keys(exchanges).map(exchange => {
    return new Promise((resolve, reject) => {
      http.get(exchanges[exchange].url, data => {
        let unified = unifyData(exchange, data);
        unified.timestamp = {
          request: requestDate,
          response: new Date()
        };
        resolve(unified);
      });
    });
  });
  Promise.all(promises).then(arr => {
    let res = {};
    Object.keys(exchanges).map((exchange, i) => res[exchange] = arr[i]);
    handleSuccess(req, res);
  });
});

app.get('/exchanges', (res, req) => {  
  handleSuccess(req, Object.keys(exchanges));
});

// catch all
app.use((req, res) => {
  handleError(res, 'unknown method');
});
