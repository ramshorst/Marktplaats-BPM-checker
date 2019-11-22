const cheerio = require('cheerio')
const request = require('request');
const async = require('async');
const Nightmare = require('nightmare');
const color = require('cli-color');
//const redis = require("redis");
//client = redis.createClient();

function doTheWork() {
  getUrlsFromPage()
  // .then(urls => {
  //   // check in reddis if url exists
  //   // return filtered array
  // })
  .then((urls) => {
    urls.forEach(url => {
      //return console.log(url);
      crawl(url).then((car) => {
        printCar(car);
        // send email
        // for later us: client.set("string key", "string val", redis.print);
      });
    });
  })
}

function printCar (car) {
  if(car.price < 10000 && car.price > 2000) {
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
}

function getUrlsFromPage() {
  return new Promise((resolve, reject) => {
    const startUrl = 'https://www.marktplaats.nl/l/auto-s/volvo/f/v70+benzine/1283+473/#PriceCentsFrom:150000|PriceCentsTo:700000|constructionYearFrom:2006|distanceMeters:75000|postcode:3511PM';
    const resultUrls = [];

    request(startUrl, function (error, response, body) {
      //return console.log(error);
      let $ = cheerio.load(body);
      //console.log($('.listing-table-mobile-link'));
      $('.mp-Listing-coverLink').each(function () {
        if(this.attribs.href !== undefined) {
          resultUrls.unshift('https://www.marktplaats.nl' + this.attribs.href);
        }
      });
      resolve(resultUrls);
    });
  });
}

function crawl(url) {
  return new Promise((resolve, reject) => {
    request(url, function (error, response, body) {
      let $ = cheerio.load(body);
      const nightmare = Nightmare({ show: true });

      let kenteken = "";
        for (let i = 0; i< 6; i++) {
          if ($('.key').eq(i).text() === 'Kenteken:') {
            kenteken = $('.value').eq(i).text();
            break;
          }
        }

      const car = {
        url,
        response: response && response.statusCode,
        error: error,
        number_plate: kenteken,
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
