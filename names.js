const ENDPOINT = "https://mainnet.infura.io"
const ETHERSCAN_KEY = "9TXZ4JKNUJCZSMVHCMUF4IUYU8BQ2RKFTA"
const https = require("https")
const Web3 = require("web3");
let web3 = new Web3(ENDPOINT)


const sql = require("sqlite3").verbose()
let db = new sql.Database("nfts.db")

getNameData()

async function getNameData(contract) {
  let name
  console.log("getting name for", contract)
  let abi = await getABIFromAddress(contract)
  if (abi == "unverified") {
    contractToNames[row.contract] = "unverified"
  } else {
    try {
      let contract = new web3.eth.Contract(abi, contract)
      name = await contract.methods.name().call()
      name = name.replace(/"/g, "")
    } catch (e) {
      name = "no_name"
    }
  }
  return name
}


function writeDataToDB(data) {
  for (let contract in data) {
    db.serialize(() => {
      console.log(`update stats set name = "${data[contract]}" where contract = "${contract}"`)
      db.each(`update stats set name = "${data[contract]}" where contract = "${contract}"`)
    })
  }
  console.log('wrote')
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