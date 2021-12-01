const ENDPOINT = "https://mainnet.infura.io/v3/1040af02e41547ef9604ffd4013d8f78"
const ETHERSCAN_KEY = "9TXZ4JKNUJCZSMVHCMUF4IUYU8BQ2RKFTA"
const https = require("https")
const Web3 = require("web3");
const fs = require("fs")
const InputDataDecoder = require('ethereum-input-data-decoder');
const decoder = new InputDataDecoder("openseaABI.json");
const sql = require("sqlite3").verbose()
let db = new sql.Database("nfts.db")
let web3 = new Web3(ENDPOINT)
let knownBlockRange;
let totalBlocksParsed;

const CHUNK_SIZE = 5
const ON_START = getNewBlocks

start()

function start() {
  db.all(`select MIN(blockNum), MAX(blockNum) from sales;`, [], (err, row) => {
    let min = row[0]['MIN(blockNum)']
    let max = row[0]['MAX(blockNum)']
    totalBlocksParsed = max - min
    knownBlockRange = [min, max]
    console.log("KNOWN BLOCK RANGE: " + knownBlockRange)
    ON_START()
  })

}

async function getNewBlocks() {
  console.log("\nGetting blocks", knownBlockRange[1], "-", knownBlockRange[1] + CHUNK_SIZE)
  await getEvents(knownBlockRange[1], knownBlockRange[1] + CHUNK_SIZE)
}

async function getOldBlocks() {
  console.log("\nGetting blocks", knownBlockRange[0] - CHUNK_SIZE, "-", knownBlockRange[0])
  await getEvents(knownBlockRange[0] - 5, knownBlockRange[0] + CHUNK_SIZE)

}

async function getEvents(fromBlock, toBlock) {
  let contract = new web3.eth.Contract(getOsABI(), "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b")
  let txns
  let data = {}
  await contract.getPastEvents("OrdersMatched", { fromBlock: fromBlock, toBlock: toBlock }).then((d) => { txns = d })
  console.log("parsing " + txns.length + " OpenSea txns")
  let count = 1
  for (tx of txns) {
    await web3.eth.getTransaction(tx['transactionHash'], async (error, txResult) => {
      let result = decoder.decodeData(txResult.input)
      let txHash = tx['transactionHash']
      let price = result['inputs'][1][4].toString(10)
      let tokenContract = "0x" + result['inputs'][0][4]
      price = web3.utils.fromWei(price)

      if (data[tokenContract] != undefined) {
        // console.log("pushing")
        data[tokenContract].push([tx['blockNumber'], price, txHash])
      } else {
        // console.log("adding")
        data[tokenContract] = [[tx['blockNumber'], price, txHash]]
      }
      if (count >= txns.length) {
        await afterData(data)
      }
      count++

    })
  }
}

async function afterData(data) {
  // console.log(data)
  for (let contractAddr in data) {
    for (let sale of data[contractAddr]) {
      // console.log(sale)
      let blockNum = sale[0]
      let salePrice = sale[1]
      let final = [contractAddr, blockNum, salePrice, sale[2]]
      await writeToDB(final)
    }
  }
  knownBlockRange[1] + CHUNK_SIZE
  totalBlocksParsed += CHUNK_SIZE
  console.log("Parsed " + totalBlocksParsed + " blocks so far")
  updateStats(data)
  ON_START()
}

async function writeToDB(data) {
  db.run("INSERT INTO sales(contract, blockNum, price, tx) values (?, ?, ?, ?)", [data[0], data[1], parseFloat(data[2]), data[3]], (err) => {
    if (err) {
      console.log(err)
    }
  })
}

function getOsABI() {
  let data = fs.readFileSync("openseaABI.json")
  return JSON.parse(data)
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
  return data
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

function addParams(url, params) {
  url += "?";
  for (const property in params) {
    url += (`${property}=${params[property]}&`);
  }
  url = url.substring(0, url.length - 1);
  // console.log(url)
  return url
}