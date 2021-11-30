const sql = require("sqlite3").verbose()
const ENDPOINT = "https://mainnet.infura.io/v3/1040af02e41547ef9604ffd4013d8f78"
const ETHERSCAN_KEY = "9TXZ4JKNUJCZSMVHCMUF4IUYU8BQ2RKFTA"
const https = require("https")
const Web3 = require("web3");
const fs = require("fs")

let web3 = new Web3(ENDPOINT)
let db = new sql.Database("nfts.db")

let contracts = []
db.all("select contract from sales;", [], (err, rows) => {
  rows.forEach(r => { contracts.push(r['contract']) })
  contracts = [... new Set(contracts)]
  parseByContract()
})

function parseByContract() {
  let data = {}
  // console.log(contracts)
  let contractCount = 0
  let txCount = 0
  console.log("Loading and parsing " + contracts.length + " contracts")
  for (let contract of contracts) {
    data[contract] = { numSales: 0, volume: 0, avgPrice: 0 }
    db.all(`select * from sales where contract="${contract}"`, [], (err, rows) => {
      rows.forEach(row => {
        txCount++
        data[contract].numSales++
        data[contract].volume += row.price
        data[contract].avgPrice = data[contract].volume / data[contract].numSales
      })
      contractCount++
      updateConsole("Total contracts parsed so far: " + contractCount)
      if (contractCount >= contracts.length) {
        console.log("Parsed " + txCount + " sales, getting names")
        getNameData(contracts, data)
      }
    })
  }
}

async function getNameData(contracts, data) {
  let count = 1
  let knownNames = JSON.parse(fs.readFileSync("contractsToNames.json"))
  // console.log(knownNames)
  for (let contract of contracts) {
    count++
    if (knownNames[contract] == undefined) { // if contrace is in json
      // console.log("getting name")
      let abi = await getABIFromAddress(contract)
      if (abi == "unverified") {
        data[contract].name = "unverified"

      } else {
        try {
          let smartContract = new web3.eth.Contract(abi, contract)
          data[contract].name = await smartContract.methods.name().call()
          data[contract].name = data[contract].name.replace(/"/g, "")
        } catch (e) {

          // console.log(e)
          data[contract].name = "no_name"
        }
      }
      data[contract].name = knownNames[contract]

    } else {
      // console.log(knownNames[contract])
      data[contract].name = knownNames[contract]
    }
    updateConsole(count + "/" + contracts.length + " " + (count / contracts.length * 100).toFixed(2) + "%\tgot name for " + data[contract].name)
  }
  console.log("\nGot all names, writing to db")
  writeObj(knownNames)
  writeToDB(data)
}

function updateConsole(line) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(line);
}

function writeObj(obj) {
  // console.log(obj)
  fs.writeFileSync('./contractsToNames.json', JSON.stringify(obj, null, 2), 'utf-8');
  console.log("Wrote contractsToNames.json")
}

function writeToDB(data) {
  for (let contract in data) {
    db.serialize(() => {
      // console.log(`INSERT INTO stats(contract, name, numSales, volume, avgPrice) VALUES("${contract}", "${data[contract].name}", ${data[contract].numSales}, ${data[contract].volume}, ${data[contract].avgPrice});`)
      db.each(`INSERT OR REPLACE INTO stats(contract, name, numSales, volume, avgPrice) VALUES("${contract}", "${data[contract].name}", ${data[contract].numSales}, ${data[contract].volume}, ${data[contract].avgPrice});`)
    })
  }
  db.close();
  console.log('SUCESS! Data has been colected and saved!')
}

async function getABIFromAddress(address) {
  let params = {
    "module": "contract",
    "action": "getabi",
    "address": address,
    "apikey": ETHERSCAN_KEY
  }
  let url = addParams("https://api.etherscan.io/api", params)

  data = await get(url)
  try {
    data = JSON.parse(data)
  } catch (e) {
    data = "unverified"
  }
  // console.log(data)
  return data
}

function addParams(url, params) {
  url += "?";
  for (const property in params) {
    url += (`${property}=${params[property]}&`);
  }
  url = url.substring(0, url.length - 1);
  // console.log(url)
  return url
}

async function get(url) {
  return new Promise((resolve => {
    let data = ""
    https.get(url, (res) => {
      res.on('data', (d) => {
        data += d
      });
      res.on("end", () => {
        resolve(JSON.parse(data)['result'])
      })
    }).on('error', (e) => {
      console.error(e);
    });
  }))
}
