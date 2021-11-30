const sql = require("sqlite3").verbose()
const ENDPOINT = "https://mainnet.infura.io/1040af02e41547ef9604ffd4013d8f78"
const ETHERSCAN_KEY = "9TXZ4JKNUJCZSMVHCMUF4IUYU8BQ2RKFTA"
const https = require("https")
const Web3 = require("web3");
const fs = require("fs")

let web3 = new Web3(ENDPOINT)
let db = new sql.Database("nfts.db")

let contracts = []
db.all("select contract from sales", [], (err, rows) => {
  rows.forEach(r => { contracts.push(r['contract']) })
  contracts = [... new Set(contracts)]
  parseByContract()
})

function parseByContract() {
  let data = {}
  // console.log(contracts)
  let count = 0
  console.log("Loading and parsing " + contracts.length + " contracts")
  for (let contract of contracts) {
    data[contract] = { numSales: 0, volume: 0, avgPrice: 0 }
    db.all(`select * from sales where contract="${contract}"`, [], (err, rows) => {
      rows.forEach(row => {
        data[contract].numSales++
        data[contract].volume += row.price
        data[contract].avgPrice = data[contract].volume / data[contract].numSales
      })
      count++
      if (count >= contracts.length) {
        console.log("Data parsed, getting names")
        getNameData(contracts, data)
      }
    })
  }
}

async function getNameData(contracts, data) {
  let count = 1
  let contractsToNames = {}
  let knownNames = JSON.parse(fs.readFileSync("contractsToNames.json"))
  for (let contract of contracts) {
    updateConsole(count + "/" + contracts.length + " " + (count / contracts.length).toFixed(2) + "%\tgetting name for " + contract)
    let abi = await getABIFromAddress(contract)
    if (knownNames[contract] != undefined) {
      if (abi == "unverified") {
        data[contract].name = "unverified"
      } else {
        try {
          let contract = new web3.eth.Contract(abi, contract)
          data[contract].name = await contract.methods.name().call()
          data[contract].name = data[contract].name.replace(/"/g, "")
        } catch (e) {
          data[contract].name = "no_name"
        }
      }
      contractsToNames[contract] = data[contract].name
      count++

    } else {
      data[contract].name = contractsToNames[contract]
    }
  }
  console.log("Got all names, writing to db")
  writeObj(contractsToNames)
  writeToDB(data)
}

function updateConsole(line) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(line);
}

function writeObj(obj) {
  fs.writeFileSync('./contactsToNames.json', JSON.stringify(obj, null, 2), 'utf-8');
  console.log("Wrote contractsToNames.json")
}

function writeToDB(data) {
  for (let contract in data) {
    db.serialize(() => {
      db.each(`INSERT INTO stats(contract, name, numSales, volume, avgPrice) VALUES(${data[contract].numSales}, ${data[contract].volume}, ${data[contract].avgPrice};`)
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
