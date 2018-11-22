const cheerio = require('cheerio')
const request = require('request');
const async = require('async');
const Nightmare = require('nightmare');
const color = require('cli-color');
const redis = require("redis");
client = redis.createClient();

function doTheWork() {
  getUrlsFromPage(7)
  // .then(urls => {
  //   // check in reddis if url exists
  //   // return filtered array
  // })
  .then((urls) => {
    urls.forEach(url => {
      crawl(url).then((car) => {
        printCar(car);
        // send email
        // for later us: client.set("string key", "string val", redis.print);
      });
    });
  })
}

function printCar (car) {
  display = '-' + car.discount + '% €' + car.price + ' ' + car.url;
  if (car.discount <= 10) {
    return console.log(color.white(display));
  } else if (car.discount <= 30) {
    return console.log(color.yellow(display));
  } else if (car.discount <= 40) {
    return console.log(color.orange.bold(display));
  } else {
    return console.log(color.green.bold(display));
  }
}

function getUrlsFromPage(pageNumber) {
  return new Promise((resolve, reject) => {
    const startUrl = 'https://www.marktplaats.nl/z/auto-s.html?categoryId=91&attributes=S%2C10898&priceTo=15.000%2C00&yearFrom=2006&attributes=N%2C186&attributes=N%2C187&startDateFrom=always' + '&currentPage=' + pageNumber;
    const resultUrls = [];

    request(startUrl, function (error, response, body) {
      let $ = cheerio.load(body);
      //console.log($('.listing-table-mobile-link'));
      $('.listing-table-mobile-link').each(function () {
        resultUrls.push(this.attribs.href);
      });
      resolve(resultUrls);
    });
  });
}

function crawl(url) {
  return new Promise((resolve, reject) => {
    request(url, function (error, response, body) {
      let $ = cheerio.load(body);
      const nightmare = Nightmare({ show: false });

      const car = {
        url,
        response: response && response.statusCode,
        error: error,
        number_plate: $('.value').eq(3).text(),
        price: $('.price').eq(0).text().replace(/[^0-9,-]+/g,"").replace(',', '.'),
        year: $('.trust-item-value').eq(0).text(),
        km: $('.value').eq(7).text(),
        date: $('#displayed-since span').eq(2).text()
      }

      nightmare
        .goto('https://diensten.vwe.nl/dienst/bpm/BpmCalculatorExport.aspx')
        .type('#InputControl_txtKenteken', car.number_plate)
        .click('#btnCalculate')
        .wait('#lblBedragTerug, #InputControl_valErrorSummary ul')
        .evaluate(() => {
           const error = document.querySelector('#InputControl_valErrorSummary').innerText.trim() ;
           const bpm = document.querySelector('#lblBedragTerug') && document.querySelector('#lblBedragTerug').innerText;
           return {error, bpm};
         })
         .end()
         .then((result) => {
           const price = Number(car.price)
           const bpm = result.error ? 0 : Number(result.bpm)
           const discount = Math.round(100*bpm/price);
           const carObject = {
             price,
             bpm,
             discount,
             url: car.url.split("?")[0]
           }
           resolve(carObject);
         })
    });
  });
}

// async.mapSeries([1,2,3,4,5,6,7,8,9,10], getCars, function(error, results) {
//   console.log(results);
// });

doTheWork();
