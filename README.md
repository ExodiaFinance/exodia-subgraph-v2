# Exodia Finance Subgraph V2
A major refactor from the [old subgraph](https://github.com/ExodiaFinance/exodia-subgraph)
## Maintenance
Updating this subgraph code and redeploying is required when any of the following occurs:
- New tokens are added to the treasury with prices not previously tracked
- New bonds are deployed which contain new tokens with prices not previously tracked

New tokens will be priced as $0 if they are not added to the price tracking
See [list of tokens tracked](##Token-Prices-Tracked)

## Adding new tokens to track price
1. Add new priceMap object to priceMaps array in `src/utils/priceMap.ts`
```
	class  PriceMap {
		name:  string // name of token to track
		tokenAddress:  string // address of token to track
		isExod:  boolean // token to track is EXOD
		iswsExod:  boolean // token to track is wsEXOD
		isStable:  boolean // token to track is a stable coin
		isOracle:  boolean // token price is fetched from an oracle
		isUniLp:  boolean // token price is fetched from a uni lp token/stablecoin pair
		isWeightedPool2:  boolean // token price is fetched from a balancer token/stable pool
		isUniLpToken:  boolean // token to track is a uni lp token
		isBptToken:  boolean // token to track is a balancer pool token
		contractAddress:  string // address of contract to fetch token price from i.e oracle, uni lp, weighted pool
	} 

	export  const  priceMaps:  PriceMap[] = [
		{
			name:  "EXOD",
			tokenAddress:  "0x3b57f3FeAaF1e8254ec680275Ee6E7727C7413c7",
			isExod:  true,
			iswsExod:  false,
			isStable:  false,
			isOracle:  false,
			isUniLp:  false,
			isWeightedPool2:  false,
			isUniLpToken:  false,
			isBptToken:  false,
			contractAddress:  "",
		},
		// Add new token to track price here
	]
```
2. Deploy new subgraph by grafting from block number where the new token was added. see [deploy subgraph with graft](##Deploy-subgraph-with-grafting)
3. Update README.md to add new tokens tracked to the [list](##Token-Prices-Tracked)
## Adding new bonds
1. Update `subgraph.yaml` to include new bond
```
#Template Bond
-  kind:  ethereum
	name:  TokenBond  #1. change to name of new bond
	network:  fantom
	source:
	address:  "0x39086c3E5979d6F0aB0a54e3135D6e3eDD53c395"  #2. change to contract address of new bond
	abi:  Bond
	startBlock:  29523359  #3. change to block number when bond was deployed
	mapping:
		kind:  ethereum/events
		apiVersion:  0.0.5
		language:  wasm/assemblyscript
		entities:
			-  BondCreated
			abis:
			-  name:  TreasuryTracker
				file:  ./abis/TreasuryTracker.json
			-  name:  CirculatingSupply
				file:  ./abis/CirculatingSupply.json
			-  name:  EXODERC20
				file:  ./abis/EXODERC20.json
			-  name:  UniswapV2Pair
				file:  ./abis/UniswapV2Pair.json
			-  name:  SEXODERC20
				file:  ./abis/SEXODERC20.json
			-  name:  ExodStaking
				file:  ./abis/ExodStaking.json
			-  name:  ERC20
				file:  ./abis/ERC20.json
			-  name:  BalancerVault
				file:  ./abis/BalancerVault.json
			-  name:  WeightedPool
				file:  ./abis/WeightedPool.json
			-  name:  PriceOracle
				file:  ./abis/PriceOracle.json
			-  name:  WeightedPool2
				file:  ./abis/WeightedPool2.json
			-  name:  WSEXODERC20
				file:  ./abis/WSEXODERC20.json
			-  name:  Bond
				file:  ./abis/Bond.json
		eventHandlers:
			-  event:  BondCreated(uint256,indexed uint256,indexed uint256,indexed uint256)
				handler:  handleBondCreated
		file:  ./src/mappings/bonds/TokenBond.ts  #4. change to location of mapping file
```
2. Add new mapping to `src/mappings/bonds`. copy paste the contents of `src/mappings/bonds/TEMPLATEBOND.ts` into the new mapping file. No need to change anything.
```
import { BondCreated } from  '../../../generated/DAIBond/Bond'
import { updateBond } from  '../../entitites/Bond'
import { createBondDeposit } from  '../../entitites/BondDeposit'

export  function  handleBondCreated(bond:  BondCreated):  void {
	updateBond(bond, createBondDeposit(bond))
}
```
 3. Add new tokens to track price. see [how to add new tokens to track price](##Adding-new-tokens-to-track-price)
 4. Deploy new subgraph by grafting from block number where the new token was added. see [deploy subgraph with graft](##Deploy-subgraph-with-grafting)
 5. Update README.md to add any new tokens tracked into the list below
## Deploy subgraph with grafting
1. in `subgraph.yaml`: 
	i. change graft base to current subgraph ID
	ii. change graft block to desired block number 
```
specVersion:  0.0.2
graft:
	base:  QmXorDQbyYadWx94gog7cvcBSV5gwcmSYqeubHcyYdiT71
	block:  30018645
schema:
	file:  ./schema.graphql
dataSources:
...
```
## Token Prices Tracked
 - EXOD
 - wsEXOD
 - DAI
 - USDC
 - MAI
 - FTM
 - gOHM
 - fBEETS
 - BEETS
 - EXODDAI Uni LP pair
 - The Monolith BPT token
