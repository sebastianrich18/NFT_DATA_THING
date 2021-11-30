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
let startBlock = 13660899
let totalBlocksParsed = 33615

getBlocks(startBlock)

async function getBlocks(start) {
  await getEvents(start - 5, start)
  totalBlocksParsed += 5
  console.log("got blocks " + (start - 5) + "-" + start)
  console.log("Parsed " + totalBlocksParsed + " blocks so far")
  getBlocks(start - 5)

}

async function getEvents(fromBlock, toBlock) {
  let contract = new web3.eth.Contract(getOsABI(), "0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b")
  let txns
  let data = {}
  await contract.getPastEvents("OrdersMatched", { fromBlock: fromBlock, toBlock: toBlock }).then((d) => { txns = d })
  console.log("parsing " + txns.length + " OpenSea txns")
  let count = 1
  for (tx of txns) {
    await web3.eth.getTransaction(tx['transactionHash'], (error, txResult) => {
      let result = decoder.decodeData(txResult.input)
      let price = result['inputs'][1][4].toString(10)
      let tokenContract = "0x" + result['inputs'][0][4]
      price = web3.utils.fromWei(price)

      if (data[tokenContract] != undefined) {
        // console.log("pushing")
        data[tokenContract].push([tx['blockNumber'], price])
      } else {
        // console.log("adding")
        data[tokenContract] = [[tx['blockNumber'], price]]
      }
      if (count >= txns.length) {
        afterData(data)
      }
      count++

    })
  }
}

function afterData(data) {
  // console.log(data)
  for (let contractAddr in data) {
    for (let sale of data[contractAddr]) {
      let blockNum = sale[0]
      let salePrice = sale[1]
      let final = [contractAddr, blockNum, salePrice]
      writeToDB(final)
    }
  }
}

function writeToDB(data) {
  // console.log(data)
  db.serialize(() => {
    db.each(`INSERT INTO sales(contract, blockNum, price) values ("${data[0]}", ${data[1]}, ${parseFloat(data[2])})`)
  })
  // console.log("wrote data to db")
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