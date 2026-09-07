(()=>{
'use strict';
const q=new URLSearchParams(location.search);
const original=(q.get('symbol')||'BTC').trim();

function canonicalSymbol(input){
  let raw=String(input||'BTC').trim();
  if(!raw)return'BTC';

  // Preserve camel-case information before upper-casing. This repairs values
  // such as BitcoinBTC, EthereumETH and SolanaSOL produced by concatenated
  // name+symbol UI text.
  const camelTail=raw.match(/([A-Z][A-Z0-9]{1,9})$/);
  if(camelTail&&/[a-z]/.test(raw.slice(0,camelTail.index)))raw=camelTail[1];

  let s=raw.toUpperCase().replace(/[^A-Z0-9]/g,'');

  // Accept pair-shaped inputs without accidentally creating BTCUSDTUSDT.
  for(const quote of ['USDT','USDC','BUSD','USD']){
    if(s.endsWith(quote)&&s.length>quote.length){s=s.slice(0,-quote.length);break;}
  }

  // Defensive aliases for concatenated display-name + ticker values.
  const aliases={
    BITCOINBTC:'BTC',ETHEREUMETH:'ETH',SOLANASOL:'SOL',XRPXRP:'XRP',
    CARDANOADA:'ADA',DOGECOINDOGE:'DOGE',CHAINLINKLINK:'LINK',
    AVALANCHEAVAX:'AVAX',POLKADOTDOT:'DOT',LITECOINLTC:'LTC',
    STELLARXLM:'XLM',SUI:SUI='SUI',TONCOINTON:'TON',TRONTRX:'TRX',
    SHIBAINUSHIB:'SHIB',UNISWAPUNI:'UNI',AAVEAAVE:'AAVE',
    BITCOINCASHBCH:'BCH',NEARPROTOCOLNEAR:'NEAR',APTOSAPT:'APT',
    ARBITRUMARB:'ARB',OPTIMISMOP:'OP',PEPEPEPE:'PEPE',RENDERRENDER:'RENDER'
  };
  if(aliases[s])s=aliases[s];

  return s||'BTC';
}

const canonical=canonicalSymbol(original);
if(canonical!==original){
  q.set('symbol',canonical);
  const next=`${location.pathname}?${q.toString()}${location.hash}`;
  history.replaceState(null,'',next);
}
window.WavelengthAssetSymbol=canonical;
})();
