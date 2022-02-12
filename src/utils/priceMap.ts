class PriceMap {
  name: string
  tokenAddress: string
  isExod: boolean
  iswsExod: boolean
  isStable: boolean
  isOracle: boolean
  isUniLp: boolean
  isWeightedPool2: boolean
  contractAddress: string
  priceDecimals: number
}

export const priceMaps: PriceMap[] = [
  {
    name: "EXOD",
    tokenAddress: "0x3b57f3FeAaF1e8254ec680275Ee6E7727C7413c7",
    isExod: true,
    iswsExod: false,
    isStable: false,
    isOracle: false,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "",
    priceDecimals: 0,
  },
  {
    name: "wsEXOD",
    tokenAddress: "0xe992C5Abddb05d86095B18a158251834D616f0D1",
    isExod: false,
    iswsExod: true,
    isStable: false,
    isOracle: false,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "",
    priceDecimals: 0,
  },
  {
    name: "DAI",
    tokenAddress: "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e",
    isExod: false,
    iswsExod: false,
    isStable: true,
    isOracle: false,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "",
    priceDecimals: 0,
  },
  {
    name: "MAI",
    tokenAddress: "0xfb98b335551a418cd0737375a2ea0ded62ea213b",
    isExod: false,
    iswsExod: false,
    isStable: true,
    isOracle: false,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "",
    priceDecimals: 0,
  },
  {
    name: "wFTM",
    tokenAddress: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",
    isExod: false,
    iswsExod: false,
    isStable: false,
    isOracle: true,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
    priceDecimals: 8
  },
  {
    name: "gOHM",
    tokenAddress: "0x91fa20244fb509e8289ca630e5db3e9166233fdc",
    isExod: false,
    iswsExod: false,
    isStable: false,
    isOracle: true,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "0x5E1DEE184a4809EBfcEDa72E4287f4d2d62dC6C1",
    priceDecimals: 8
  },
  {
    name: "fBEETS",
    tokenAddress: "0xfcef8a994209d6916EB2C86cDD2AFD60Aa6F54b1",
    isExod: false,
    iswsExod: false,
    isStable: false,
    isOracle: true,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "0xB90Fc1e595C19d84eAeC802f95d32619bB2dE7A0",
    priceDecimals: 8
  },
  {
    name: "BEETS",
    tokenAddress: "0xF24Bcf4d1e507740041C9cFd2DddB29585aDCe1e",
    isExod: false,
    iswsExod: false,
    isStable: false,
    isOracle: false,
    isUniLp: false,
    isWeightedPool2: true,
    contractAddress: "0x03c6B3f09D2504606936b1A4DeCeFaD204687890",
    priceDecimals: 18,
  },
  {
    name: "USDC",
    tokenAddress: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75",
    isExod: false,
    iswsExod: false,
    isStable: true,
    isOracle: false,
    isUniLp: false,
    isWeightedPool2: false,
    contractAddress: "",
    priceDecimals: 0,
  }
]