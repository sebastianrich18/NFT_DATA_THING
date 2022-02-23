# NFT VOLUME ANALYSIS
>Get sale data for every NFT on Opensea

# USEAGE
* clone the repo: `git clone https://github.com/sebastianrich18/NFT_DATA_THING`
* cd into repo `cd NFT_DATA_THING`
* To start collecting data run `node app.js`
  * This will begin going back from current block getting every sale in 100 block steps
* To get stats on the data run `node stats.js`
  * This will generate average price, total volume, and total number of sales for each collection
* To view data run `sqlite3 nfts.db`
  * Every sale is under table `sales`
  * Stats for every collection is under table `stats`
