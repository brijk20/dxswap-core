import { Contract, Wallet } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { defaultAbiCoder } from 'ethers/utils'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals, expandToDecimals } from './utilities'

import ERC20 from '../../build/ERC20.json'
import WETH9 from '../../build/WETH9.json'
import DXswapFactory from '../../build/DXswapFactory.json'
import DXswapPair from '../../build/DXswapPair.json'
import DXswapDeployer from '../../build/DXswapDeployer.json'
import DXswapFeeSetter from '../../build/DXswapFeeSetter.json'
import DXswapFeeReceiver from '../../build/DXswapFeeReceiver.json'

interface FactoryFixture {
  factory: Contract
  feeSetter: Contract
  feeReceiver: Contract
  WETH: Contract
  honeyToken: Contract
  hsfToken: Contract
}

const overrides = {
  gasLimit: 9999999
}

export async function factoryFixture(provider: Web3Provider, [dxdao, ethReceiver]: Wallet[]): Promise<FactoryFixture> {
  const WETH = await deployContract(dxdao, WETH9)
  const honeyToken = await deployContract(dxdao, ERC20, [expandTo18Decimals(1000)])
  const hsfToken = await deployContract(dxdao, ERC20, [expandTo18Decimals(1000)])
  const dxSwapDeployer = await deployContract(
    dxdao, DXswapDeployer, [ dxdao.address, WETH.address, [], [], [], honeyToken.address, hsfToken.address,
      ethReceiver.address, ethReceiver.address, expandToDecimals(5, 9)], overrides
  )
  await dxdao.sendTransaction({to: dxSwapDeployer.address, gasPrice: 0, value: 1})
  const deployTx = await dxSwapDeployer.deploy()
  const deployTxReceipt = await provider.getTransactionReceipt(deployTx.hash);
  const factoryAddress = deployTxReceipt.logs !== undefined
    ? defaultAbiCoder.decode(['address'], deployTxReceipt.logs[0].data)[0]
    : null
  const factory = new Contract(factoryAddress, JSON.stringify(DXswapFactory.abi), provider).connect(dxdao)
  const feeSetterAddress = await factory.feeToSetter()
  const feeSetter = new Contract(feeSetterAddress, JSON.stringify(DXswapFeeSetter.abi), provider).connect(dxdao)
  const feeReceiverAddress = await factory.feeTo()
  const feeReceiver = new Contract(feeReceiverAddress, JSON.stringify(DXswapFeeReceiver.abi), provider).connect(dxdao)
  return { factory, feeSetter, feeReceiver, WETH, honeyToken, hsfToken }
}

interface PairFixture extends FactoryFixture {
  token0: Contract
  token1: Contract
  pair: Contract
  wethPair: Contract
  wethPairToken0: Contract
  honeyWethPair: Contract
  hsfWethPair: Contract
}

export async function pairFixture(provider: Web3Provider, [dxdao, wallet, ethReceiver]: Wallet[]): Promise<PairFixture> {
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)
  const WETH = await deployContract(wallet, WETH9)
  await WETH.deposit({value: expandTo18Decimals(1000)})
  const honeyToken = await deployContract(dxdao, ERC20, [expandTo18Decimals(10000)])
  const hsfToken = await deployContract(dxdao, ERC20, [expandTo18Decimals(10000)])
  const token0 = tokenA.address < tokenB.address ? tokenA : tokenB
  const token1 = token0.address === tokenA.address ? tokenB : tokenA

  const dxSwapDeployer = await deployContract(
    dxdao, DXswapDeployer, [
      dxdao.address,
      WETH.address,
      [token0.address, token1.address, token0.address, honeyToken.address, hsfToken.address],
      [token1.address, WETH.address, WETH.address, WETH.address, WETH.address],
      [15, 15, 15, 15, 15],
      honeyToken.address,
      hsfToken.address,
      ethReceiver.address,
      ethReceiver.address,
      expandToDecimals(5, 9)
    ], overrides
  )
  await dxdao.sendTransaction({to: dxSwapDeployer.address, gasPrice: 0, value: 1})
  const deployTx = await dxSwapDeployer.deploy()
  const deployTxReceipt = await provider.getTransactionReceipt(deployTx.hash);
  const factoryAddress = deployTxReceipt.logs !== undefined
    ? defaultAbiCoder.decode(['address'], deployTxReceipt.logs[0].data)[0]
    : null

  const factory = new Contract(factoryAddress, JSON.stringify(DXswapFactory.abi), provider).connect(dxdao)
  const feeSetterAddress = await factory.feeToSetter()
  const feeSetter = new Contract(feeSetterAddress, JSON.stringify(DXswapFeeSetter.abi), provider).connect(dxdao)
  const feeReceiverAddress = await factory.feeTo()
  const feeReceiver = new Contract(feeReceiverAddress, JSON.stringify(DXswapFeeReceiver.abi), provider).connect(dxdao)
  const pair = new Contract(
     await factory.getPair(token0.address, token1.address),
     JSON.stringify(DXswapPair.abi), provider
   ).connect(dxdao)
  const wethPair = new Contract(
     await factory.getPair(token1.address, WETH.address),
     JSON.stringify(DXswapPair.abi), provider
   ).connect(dxdao)
  const wethPairToken0 = new Contract(
    await factory.getPair(token0.address, WETH.address),
    JSON.stringify(DXswapPair.abi), provider
  ).connect(dxdao)
  const honeyWethPair = new Contract(
    await factory.getPair(honeyToken.address, WETH.address),
    JSON.stringify(DXswapPair.abi), provider
  ).connect(dxdao)
  const hsfWethPair = new Contract(
    await factory.getPair(hsfToken.address, WETH.address),
    JSON.stringify(DXswapPair.abi), provider
  ).connect(dxdao)

  await honeyToken.transfer(honeyWethPair.address, expandTo18Decimals(100))
  await WETH.transfer(honeyWethPair.address, expandTo18Decimals(100))
  await honeyWethPair.mint(wallet.address, overrides)

  await hsfToken.transfer(hsfWethPair.address, expandTo18Decimals(100))
  await WETH.transfer(hsfWethPair.address, expandTo18Decimals(100))
  await hsfWethPair.mint(wallet.address, overrides)

  return { factory, feeSetter, feeReceiver, WETH, honeyToken, hsfToken, token0, token1, pair, wethPair,
    wethPairToken0, honeyWethPair, hsfWethPair }
}
