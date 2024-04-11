import {
  L1Network,
  L2Network,
  addCustomNetwork,
  constants
} from '@arbitrum/sdk'
import { networks as arbitrumSdkChains } from '@arbitrum/sdk/dist/lib/dataEntities/networks'

import { loadEnvironmentVariableWithFallback } from './index'
import { getBridgeUiConfigForChain } from './bridgeUiConfig'
import { orbitMainnets, orbitTestnets } from './orbitChainsList'
import { chainIdToInfuraUrl } from './infura'

export const getChains = () => {
  const chains = Object.values(arbitrumSdkChains)
  return chains.filter(chain => {
    // exclude devnet
    if (chain.chainID === 1338) {
      return false
    }
    // exclude L1 chains with no child chains
    if (isL1Chain(chain) && chain.partnerChainIDs.length === 0) {
      return false
    }
    return true
  })
}

export const customChainLocalStorageKey = 'arbitrum:custom:chains'

export type ChainWithRpcUrl = L2Network & {
  rpcUrl: string
  slug?: string
}

function getParentChain(chain: L2Network): L1Network | L2Network {
  const parentChain = arbitrumSdkChains[chain.partnerChainID]

  if (typeof parentChain === 'undefined') {
    throw new Error(
      `[getParentChain] parent chain ${chain.partnerChainID} not found for ${chain.chainID}`
    )
  }

  return parentChain
}

export function getBaseChainIdByChainId({
  chainId
}: {
  chainId: number
}): number {
  const chain = arbitrumSdkChains[chainId]

  // the chain provided is an L1 chain, so we can return early
  if (!chain || isL1Chain(chain)) {
    return chainId
  }

  let currentParentChain = getParentChain(chain)
  // keep following the parent chains until we find the L1 chain
  while (!isL1Chain(currentParentChain)) {
    currentParentChain = getParentChain(currentParentChain)
  }

  return currentParentChain.chainID
}

export function getCustomChainsFromLocalStorage(): ChainWithRpcUrl[] {
  const customChainsFromLocalStorage = localStorage.getItem(
    customChainLocalStorageKey
  )

  if (!customChainsFromLocalStorage) {
    return []
  }

  return (JSON.parse(customChainsFromLocalStorage) as ChainWithRpcUrl[])
    .filter(
      // filter again in case local storage is compromised
      chain => !supportedCustomOrbitParentChains.includes(Number(chain.chainID))
    )
    .map(chain => {
      return {
        ...chain,
        // make sure chainID is numeric
        chainID: Number(chain.chainID)
      }
    })
}

export function getCustomChainFromLocalStorageById(chainId: ChainId) {
  const customChains = getCustomChainsFromLocalStorage()

  if (!customChains) {
    return undefined
  }

  return customChains.find(chain => chain.chainID === chainId)
}

export function saveCustomChainToLocalStorage(newCustomChain: ChainWithRpcUrl) {
  const customChains = getCustomChainsFromLocalStorage()

  if (
    customChains.findIndex(chain => chain.chainID === newCustomChain.chainID) >
    -1
  ) {
    // chain already exists
    return
  }

  const newCustomChains = [...getCustomChainsFromLocalStorage(), newCustomChain]
  localStorage.setItem(
    customChainLocalStorageKey,
    JSON.stringify(newCustomChains)
  )
}

export function removeCustomChainFromLocalStorage(chainId: number) {
  const newCustomChains = getCustomChainsFromLocalStorage().filter(
    chain => chain.chainID !== chainId
  )
  localStorage.setItem(
    customChainLocalStorageKey,
    JSON.stringify(newCustomChains)
  )
}

export enum ChainId {
  // L1
  Ethereum = 1,
  // L1 Testnets
  Local = 1337,
  Sepolia = 11155111,
  Holesky = 17000,
  // L2
  ArbitrumOne = 42161,
  ArbitrumNova = 42170,
  // L2 Testnets
  ArbitrumSepolia = 421614,
  ArbitrumLocal = 412346,
  // Orbit
  StylusTestnet = 23011913
}

export const supportedCustomOrbitParentChains = [
  ChainId.Sepolia,
  ChainId.Holesky,
  ChainId.ArbitrumSepolia
]

export const rpcURLs: { [chainId: number]: string } = {
  // L1
  [ChainId.Ethereum]: loadEnvironmentVariableWithFallback({
    env: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL,
    fallback: chainIdToInfuraUrl(ChainId.Ethereum)
  }),
  // L1 Testnets
  [ChainId.Sepolia]: loadEnvironmentVariableWithFallback({
    env: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
    fallback: chainIdToInfuraUrl(ChainId.Sepolia)
  }),
  [ChainId.Holesky]: 'https://ethereum-holesky-rpc.publicnode.com',
  // L2
  [ChainId.ArbitrumOne]: loadEnvironmentVariableWithFallback({
    env: chainIdToInfuraUrl(ChainId.ArbitrumOne),
    fallback: 'https://arb1.arbitrum.io/rpc'
  }),
  [ChainId.ArbitrumNova]: 'https://nova.arbitrum.io/rpc',
  // L2 Testnets
  [ChainId.ArbitrumSepolia]: loadEnvironmentVariableWithFallback({
    env: chainIdToInfuraUrl(ChainId.ArbitrumSepolia),
    fallback: 'https://sepolia-rollup.arbitrum.io/rpc'
  }),
  // Orbit Testnets
  [ChainId.StylusTestnet]: 'https://stylus-testnet.arbitrum.io/rpc'
}

export const explorerUrls: { [chainId: number]: string } = {
  // L1
  [ChainId.Ethereum]: 'https://etherscan.io',
  // L1 Testnets
  [ChainId.Sepolia]: 'https://sepolia.etherscan.io',
  [ChainId.Holesky]: 'https://holesky.etherscan.io',
  // L2
  [ChainId.ArbitrumNova]: 'https://nova.arbiscan.io',
  [ChainId.ArbitrumOne]: 'https://arbiscan.io',
  // L2 Testnets
  [ChainId.ArbitrumSepolia]: 'https://sepolia.arbiscan.io',
  // Orbit Testnets
  [ChainId.StylusTestnet]: 'https://stylus-testnet-explorer.arbitrum.io'
}

export const getExplorerUrl = (chainId: ChainId) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return explorerUrls[chainId] ?? explorerUrls[ChainId.Ethereum]! //defaults to etherscan, can never be null
}

export const getBlockTime = (chainId: ChainId) => {
  const network = arbitrumSdkChains[chainId]
  if (!network) {
    throw new Error(`Couldn't get block time. Unexpected chain ID: ${chainId}`)
  }
  return network.blockTime
}

export const getConfirmPeriodBlocks = (chainId: ChainId) => {
  const network = arbitrumSdkChains[chainId]
  if (!network || !isArbitrumChain(network)) {
    throw new Error(
      `Couldn't get confirm period blocks. Unexpected chain ID: ${chainId}`
    )
  }
  return network.confirmPeriodBlocks
}

export const l2ArbReverseGatewayAddresses: { [chainId: number]: string } = {
  [ChainId.ArbitrumOne]: '0xCaD7828a19b363A2B44717AFB1786B5196974D8E',
  [ChainId.ArbitrumNova]: '0xbf544970E6BD77b21C6492C281AB60d0770451F4'
}

export const l2DaiGatewayAddresses: { [chainId: number]: string } = {
  [ChainId.ArbitrumOne]: '0x467194771dAe2967Aef3ECbEDD3Bf9a310C76C65',
  [ChainId.ArbitrumNova]: '0x10E6593CDda8c58a1d0f14C5164B376352a55f2F'
}

export const l2wstETHGatewayAddresses: { [chainId: number]: string } = {
  [ChainId.ArbitrumOne]: '0x07d4692291b9e30e326fd31706f686f83f331b82'
}

export const l2LptGatewayAddresses: { [chainId: number]: string } = {
  [ChainId.ArbitrumOne]: '0x6D2457a4ad276000A615295f7A80F79E48CcD318'
}

export const l2MoonGatewayAddresses: { [chainId: number]: string } = {
  [ChainId.ArbitrumNova]: '0xA430a792c14d3E49d9D00FD7B4BA343F516fbB81'
}

const defaultL1Network: L1Network = {
  blockTime: 10,
  chainID: 1337,
  explorerUrl: 'http://34.142.175.48',
  isCustom: true,
  name: 'Ethereum Local',
  partnerChainIDs: [412346],
  isArbitrum: false
}

const defaultL2Network: L2Network = {
  chainID: 412346,
  partnerChainIDs: [
    // Orbit chains will go here
  ],
  confirmPeriodBlocks: 20,
  ethBridge: {
    bridge: '0x9B4477cAD544fB092B1Bc551d88465f7F13a443F',
    inbox: '0xa5d8d368c4Fc06D71724d91561d6F2a880FD4fD9',
    outbox: '0xbBaAB28Ad701e822148411376975cca7E02323d7',
    rollup: '0x9c14dfd8e5c262f9652e78f2b0a13389ee41d717',
    sequencerInbox: '0xD2B20a3B8C1d97A64eFA1120D3339d87841ccAE1'
  },
  explorerUrl: 'http://34.142.175.48:4000',
  isArbitrum: true,
  isCustom: true,
  name: 'Arbitrum Local',
  partnerChainID: 1337,
  retryableLifetimeSeconds: 604800,
  nitroGenesisBlock: 0,
  nitroGenesisL1Block: 0,
  depositTimeout: 900000,
  blockTime: constants.ARB_MINIMUM_BLOCK_TIME_IN_SECONDS,
  tokenBridge: {
    l1CustomGateway: '0x1c924636933ceDE03245f19756662e92F851293D',
    l1ERC20Gateway: '0xeBef8abC1DF5853345f319D5ACcba1d01AECCBD8',
    l1GatewayRouter: '0x932Af0F51E02a8b371d00E7448Eb6e91c013274d',
    l1MultiCall: '0x4De74F7B2a30a1Ee39b374f6F11859c334234A79',
    l1ProxyAdmin: '0xFFB9cE193d5FE12360f47a93A97d72da65c35019',
    l1Weth: '0x525c2aBA45F66987217323E8a05EA400C65D06DC',
    l1WethGateway: '0x1990703B7C717008F34d5088C2838c07B6C6e97b',
    l2CustomGateway: '0xD53b0E696c16520308186bB7c64E3dE85be45Ab9',
    l2ERC20Gateway: '0x7e6C3A78da71Ed7d6f9D3f155C5756fB1129E19c',
    l2GatewayRouter: '0x614234364127E3D5De331A9f2cBeFaE6869168eB',
    l2Multicall: '0x9815277063378fa7dE6E9a8159181b2fd44d7956',
    l2ProxyAdmin: '0x1bd440c4b2361ac11c20b5CB2409e64cB82DDb30',
    l2Weth: '0x9ffAd12EE17abF43a060760f3d93932a3DE5EB72',
    l2WethGateway: '0xf2Ec70e05fab34580B26890544dF2fF04dc63521'
  }
}

export type RegisterLocalNetworkParams = {
  l1Network: L1Network
  l2Network: L2Network
}

const registerLocalNetworkDefaultParams: RegisterLocalNetworkParams = {
  l1Network: defaultL1Network,
  l2Network: defaultL2Network
}

export const localL1NetworkRpcUrl = loadEnvironmentVariableWithFallback({
  env: process.env.NEXT_PUBLIC_LOCAL_ETHEREUM_RPC_URL,
  fallback: 'http://localhost:8545'
})
export const localL2NetworkRpcUrl = loadEnvironmentVariableWithFallback({
  env: process.env.NEXT_PUBLIC_LOCAL_ARBITRUM_RPC_URL,
  fallback: 'http://localhost:8547'
})

export function registerLocalNetwork(
  params: RegisterLocalNetworkParams = registerLocalNetworkDefaultParams
) {
  const { l1Network, l2Network } = params

  try {
    rpcURLs[l1Network.chainID] = localL1NetworkRpcUrl
    rpcURLs[l2Network.chainID] = localL2NetworkRpcUrl

    addCustomNetwork({ customL1Network: l1Network, customL2Network: l2Network })
  } catch (error: any) {
    console.error(`Failed to register local network: ${error.message}`)
  }
}

export function isNetwork(chainId: ChainId) {
  const customChains = getCustomChainsFromLocalStorage()
  const isMainnetOrbitChain = chainId in orbitMainnets
  const isTestnetOrbitChain = chainId in orbitTestnets

  const isEthereumMainnet = chainId === ChainId.Ethereum

  const isSepolia = chainId === ChainId.Sepolia
  const isHolesky = chainId === ChainId.Holesky
  const isLocal = chainId === ChainId.Local

  const isArbitrumOne = chainId === ChainId.ArbitrumOne
  const isArbitrumNova = chainId === ChainId.ArbitrumNova
  const isArbitrumSepolia = chainId === ChainId.ArbitrumSepolia
  const isArbitrumLocal = chainId === ChainId.ArbitrumLocal

  const isStylusTestnet = chainId === ChainId.StylusTestnet

  const isEthereumMainnetOrTestnet =
    isEthereumMainnet || isSepolia || isHolesky || isLocal

  const isArbitrum =
    isArbitrumOne || isArbitrumNova || isArbitrumLocal || isArbitrumSepolia

  const customChainIds = customChains.map(chain => chain.chainID)
  const isCustomOrbitChain = customChainIds.includes(chainId)

  const isCoreChain = isEthereumMainnetOrTestnet || isArbitrum
  const isOrbitChain = !isCoreChain

  const isTestnet =
    isLocal ||
    isArbitrumLocal ||
    isSepolia ||
    isHolesky ||
    isArbitrumSepolia ||
    isCustomOrbitChain ||
    isStylusTestnet ||
    isTestnetOrbitChain

  const isSupported =
    isArbitrumOne ||
    isArbitrumNova ||
    isEthereumMainnet ||
    isSepolia ||
    isHolesky ||
    isArbitrumSepolia ||
    isCustomOrbitChain ||
    isMainnetOrbitChain ||
    isTestnetOrbitChain

  return {
    // L1
    isEthereumMainnet,
    isEthereumMainnetOrTestnet,
    // L1 Testnets
    isSepolia,
    // L2
    isArbitrum,
    isArbitrumOne,
    isArbitrumNova,
    // L2 Testnets
    isArbitrumSepolia,
    // Orbit chains
    isOrbitChain,
    isTestnet,
    // General
    isSupported,
    // Core Chain is a chain category for the UI
    isCoreChain
  }
}

export function getNetworkName(chainId: number) {
  return getBridgeUiConfigForChain(chainId).network.name
}

export function getSupportedChainIds({
  includeMainnets = true,
  includeTestnets = false
}: {
  includeMainnets?: boolean
  includeTestnets?: boolean
}): ChainId[] {
  return getChains()
    .map(chain => chain.chainID)
    .filter(chainId => {
      const { isTestnet } = isNetwork(chainId)
      if (includeMainnets && !includeTestnets) {
        return !isTestnet
      }
      if (!includeMainnets && includeTestnets) {
        return isTestnet
      }
      if (!includeMainnets && !includeTestnets) {
        return false
      }
      return true
    })
}

export function mapCustomChainToNetworkData(chain: ChainWithRpcUrl) {
  // custom chain details need to be added to various objects to make it work with the UI
  //
  // add RPC
  rpcURLs[chain.chainID] = chain.rpcUrl
  // explorer URL
  explorerUrls[chain.chainID] = chain.explorerUrl
}

function isL1Chain(chain: L1Network | L2Network): chain is L1Network {
  return !chain.isArbitrum
}

function isArbitrumChain(chain: L1Network | L2Network): chain is L2Network {
  return chain.isArbitrum
}

export function getDestinationChainIds(chainId: ChainId): ChainId[] {
  const chains = getChains()
  const arbitrumSdkChain = chains.find(chain => chain.chainID === chainId)

  if (!arbitrumSdkChain) {
    return []
  }

  const parentChainId = isArbitrumChain(arbitrumSdkChain)
    ? arbitrumSdkChain.partnerChainID
    : undefined

  const validDestinationChainIds =
    chains.find(chain => chain.chainID === chainId)?.partnerChainIDs || []

  if (parentChainId) {
    // always make parent chain the first element
    return [parentChainId, ...validDestinationChainIds]
  }

  return validDestinationChainIds
}
