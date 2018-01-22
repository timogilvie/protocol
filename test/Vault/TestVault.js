/*global artifacts, web3, contract, describe, it, beforeEach*/

const expect = require('chai').expect;
const BigNumber = require('bignumber.js');

const ProxyContract = artifacts.require("Proxy");
const Vault = artifacts.require("Vault");
const TestToken = artifacts.require("TestToken");
const { expectThrow } = require('../helpers/ExpectHelper');
const { wait } = require('@digix/tempo')(web3);

contract('Vault', function(accounts) {
  const [delay, gracePeriod] = [new BigNumber('123456'), new BigNumber('1234567')];
  const num1 = new BigNumber(12);
  let proxy, vault, tokenA, tokenB;

  beforeEach(async () => {
    proxy = await ProxyContract.new(delay, gracePeriod);
    [vault, tokenA, tokenB] = await Promise.all([
      Vault.new(proxy.address, delay, gracePeriod, delay, delay),
      TestToken.new(),
      TestToken.new()
    ]);
    await proxy.grantAccess(accounts[0]);
    await proxy.grantTransferAuthorization(vault.address, { from: accounts[0] });
  });

  describe('Constructor', () => {
    it('sets constants correctly', async () => {
      const [
        contractDelay,
        contractGracePeriodExpiration,
        contractUpdateDelay,
        contractUpdateExpiration,
        owner,
        contractProxy
      ] = await Promise.all([
        vault.accessDelay.call(),
        vault.gracePeriodExpiration.call(),
        vault.updateDelay.call(),
        vault.updateExpiration.call(),
        vault.owner.call(),
        vault.PROXY.call()
      ]);

      expect(contractDelay.equals(delay)).to.be.true;
      // ?? How to check this? Don't know block timestamp of contract creation
      expect(contractGracePeriodExpiration.gt(new BigNumber(0))).to.be.true;
      expect(contractUpdateDelay.equals(delay)).to.be.true;
      expect(contractUpdateExpiration.equals(delay)).to.be.true;
      expect(owner.toLowerCase()).to.eq(accounts[0].toLowerCase());
      expect(contractProxy.toLowerCase()).to.eq(proxy.address);
    });
  });

  describe('#updateProxy', () => {
    it('allows owner to update the PROXY field after a delay', async () => {
      const newAddress = accounts[3];
      await vault.updateProxy(newAddress);

      // Expect proxy not to have changed
      let proxyAddress = await vault.PROXY.call();
      expect(proxyAddress.toLowerCase()).to.eq(proxy.address.toLowerCase());

      // Should not be able to update it without waiting
      await expectThrow(() => vault.updateProxy(newAddress));

      await wait(delay.toNumber());
      await vault.updateProxy(newAddress);

      // Now it should have changed
      proxyAddress = await vault.PROXY.call();
      expect(proxyAddress.toLowerCase()).to.eq(newAddress.toLowerCase());
    });

    it('does not allow non-owner addresses to update', async () => {
      const newAddress = accounts[3];
      await expectThrow(() => vault.updateProxy(newAddress, { from: accounts[2] }));
    });
  });

  describe('#transferToVault', () => {
    const holder1 = accounts[4];
    const id = 'TEST_ID';
    const id2 = 'TEST_ID_2';
    it('successfully transfers tokens into vault', async () => {
      await tokenA.issue(num1, { from: holder1 });
      await tokenA.approve(proxy.address, num1, { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] });

      const [balance, totalBalance, tokenBalance] = await Promise.all([
        vault.balances.call(id, tokenA.address),
        vault.totalBalances.call(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance.equals(num1)).to.be.true;
      expect(totalBalance.equals(num1)).to.be.true;
      expect(tokenBalance.equals(num1)).to.be.true;
    });

    it('successfully transfers into different vaults', async () => {
      await tokenA.issue(num1.times(new BigNumber(3)), { from: holder1 });
      await tokenA.approve(proxy.address, num1.times(new BigNumber(3)), { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await Promise.all([
        vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] }),
        vault.transferToVault(
          id2,
          tokenA.address,
          holder1,
          num1.times(new BigNumber(2)),
          { from: accounts[1] }
        )
      ]);

      const [balance, balance2, totalBalance, tokenBalance] = await Promise.all([
        vault.balances.call(id, tokenA.address),
        vault.balances.call(id2, tokenA.address),
        vault.totalBalances.call(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance.equals(num1)).to.be.true;
      expect(balance2.equals(num1.times(new BigNumber(2)))).to.be.true;
      expect(totalBalance.equals(num1.times(new BigNumber(3)))).to.be.true;
      expect(tokenBalance.equals(num1.times(new BigNumber(3)))).to.be.true;
    });

    it('successfully accounts for different tokens', async () => {
      await Promise.all([
        tokenA.issue(num1, { from: holder1 }),
        tokenB.issue(num1.times(new BigNumber(2)), { from: holder1 })
      ]);
      await Promise.all([
        tokenA.approve(proxy.address, num1, { from: holder1 }),
        tokenB.approve(proxy.address, num1.times(new BigNumber(2)), { from: holder1 }),
      ]);
      await vault.grantAccess(accounts[1]);

      await Promise.all([
        vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] }),
        vault.transferToVault(
          id,
          tokenB.address,
          holder1,
          num1.times(new BigNumber(2)),
          { from: accounts[1] }
        ),
      ]);

      const [
        balanceA,
        balanceB,
        totalBalanceA,
        totalBalanceB,
        tokenBalanceA,
        tokenBalanceB
      ] = await Promise.all([
        vault.balances.call(id, tokenA.address),
        vault.balances.call(id, tokenB.address),
        vault.totalBalances.call(tokenA.address),
        vault.totalBalances.call(tokenB.address),
        tokenA.balanceOf.call(vault.address),
        tokenB.balanceOf.call(vault.address)
      ]);

      expect(balanceA.equals(num1)).to.be.true;
      expect(balanceB.equals(num1.times(new BigNumber(2)))).to.be.true;
      expect(totalBalanceA.equals(num1)).to.be.true;
      expect(totalBalanceB.equals(num1.times(new BigNumber(2)))).to.be.true;
      expect(tokenBalanceA.equals(num1)).to.be.true;
      expect(tokenBalanceB.equals(num1.times(new BigNumber(2)))).to.be.true;
    });

    it('does not allow unauthorized addresses to call', async () => {
      await tokenA.issue(num1.times(new BigNumber(3)), { from: holder1 });
      await tokenA.approve(proxy.address, num1.times(new BigNumber(3)), { from: holder1 });
      await vault.grantAccess(accounts[1]);
      await expectThrow(
        () => vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[2] })
      );

      const [balance, totalBalance, tokenBalance] = await Promise.all([
        vault.balances.call(id, tokenA.address),
        vault.totalBalances.call(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance.equals(new BigNumber(0))).to.be.true;
      expect(totalBalance.equals(new BigNumber(0))).to.be.true;
      expect(tokenBalance.equals(new BigNumber(0))).to.be.true;
    });

    it('throws on insufficient balance or proxy allowance', async () => {
      await vault.grantAccess(accounts[1]);

      await expectThrow(
        () => vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] })
      );
      await tokenA.issue(num1.times(new BigNumber(3)), { from: holder1 });
      await expectThrow(
        () => vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] })
      );

      const [balance, totalBalance, tokenBalance] = await Promise.all([
        vault.balances.call(id, tokenA.address),
        vault.totalBalances.call(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance.equals(new BigNumber(0))).to.be.true;
      expect(totalBalance.equals(new BigNumber(0))).to.be.true;
      expect(tokenBalance.equals(new BigNumber(0))).to.be.true;
    });
  });

  describe('#sendFromVault', () => {
    const holder1 = accounts[4];
    const receiver = accounts[4];
    const id = 'TEST_ID';
    const id2 = 'TEST_ID_2';

    it('Sends tokens if vault has balance', async () => {
      await tokenA.issue(num1, { from: holder1 });
      await tokenA.approve(proxy.address, num1, { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] });

      await vault.sendFromVault(id, tokenA.address, receiver, num1, { from: accounts[1] });

      const [balance, totalBalance, receiverBalance] = await Promise.all([
        vault.balances(id, tokenA.address),
        vault.totalBalances(tokenA.address),
        tokenA.balanceOf.call(receiver)
      ]);

      expect(balance.equals(new BigNumber(0))).to.be.true;
      expect(totalBalance.equals(new BigNumber(0))).to.be.true;
      expect(receiverBalance.equals(num1)).to.be.true;
    });

    it('Does not send tokens if vault does not have balance', async () => {
      await tokenA.issue(num1, { from: holder1 });
      await tokenA.approve(proxy.address, num1, { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] });

      await expectThrow(
        () => vault.sendFromVault(id2, tokenA.address, receiver, num1, { from: accounts[1] })
      );

      const [balance, totalBalance, vaultTokenBalance] = await Promise.all([
        vault.balances(id, tokenA.address),
        vault.totalBalances(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance.equals(num1)).to.be.true;
      expect(totalBalance.equals(num1)).to.be.true;
      expect(vaultTokenBalance.equals(num1)).to.be.true;
    });

    it('Does not allow unauthorized addresses to send', async () => {
      await tokenA.issue(num1, { from: holder1 });
      await tokenA.approve(proxy.address, num1, { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] });

      await expectThrow(
        () => vault.sendFromVault(id, tokenA.address, receiver, num1, { from: accounts[2] })
      );

      const [balance, totalBalance, vaultTokenBalance] = await Promise.all([
        vault.balances(id, tokenA.address),
        vault.totalBalances(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance.equals(num1)).to.be.true;
      expect(totalBalance.equals(num1)).to.be.true;
      expect(vaultTokenBalance.equals(num1)).to.be.true;
    });
  });

  describe('#transferBetweenVaults', () => {
    const holder1 = accounts[4];
    const id = 'TEST_ID';
    const id2 = 'TEST_ID_2';
    const id3 = 'TEST_ID_3';

    it('transfers balance to a new vault', async () => {
      await tokenA.issue(num1, { from: holder1 });
      await tokenA.approve(proxy.address, num1, { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] });

      await vault.transferBetweenVaults(id, id2, tokenA.address, num1, { from: accounts[1] });

      const [balance1, balance2, totalBalance, tokenBalance] = await Promise.all([
        vault.balances(id, tokenA.address),
        vault.balances(id2, tokenA.address),
        vault.totalBalances(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance1.equals(new BigNumber(0))).to.be.true;
      expect(balance2.equals(num1)).to.be.true;
      expect(totalBalance.equals(num1)).to.be.true;
      expect(tokenBalance.equals(num1)).to.be.true;
    });

    it('Does not transfer tokens if vault does not have balance', async () => {
      await tokenA.issue(num1, { from: holder1 });
      await tokenA.approve(proxy.address, num1, { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] });

      await expectThrow(
        () => vault.transferBetweenVaults(id3, id2, tokenA.address, num1, { from: accounts[1] })
      );

      const [balance1, balance2, totalBalance, tokenBalance] = await Promise.all([
        vault.balances(id, tokenA.address),
        vault.balances(id2, tokenA.address),
        vault.totalBalances(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance1.equals(num1)).to.be.true;
      expect(balance2.equals(new BigNumber(0))).to.be.true;
      expect(totalBalance.equals(num1)).to.be.true;
      expect(tokenBalance.equals(num1)).to.be.true;
    });

    it('Does not allow unauthorized addresses to transfer', async () => {
      await tokenA.issue(num1, { from: holder1 });
      await tokenA.approve(proxy.address, num1, { from: holder1 });
      await vault.grantAccess(accounts[1]);

      await vault.transferToVault(id, tokenA.address, holder1, num1, { from: accounts[1] });

      await expectThrow(
        () => vault.transferBetweenVaults(id, id2, tokenA.address, num1, { from: accounts[2] })
      );

      const [balance1, balance2, totalBalance, tokenBalance] = await Promise.all([
        vault.balances(id, tokenA.address),
        vault.balances(id2, tokenA.address),
        vault.totalBalances(tokenA.address),
        tokenA.balanceOf.call(vault.address)
      ]);

      expect(balance1.equals(num1)).to.be.true;
      expect(balance2.equals(new BigNumber(0))).to.be.true;
      expect(totalBalance.equals(num1)).to.be.true;
      expect(tokenBalance.equals(num1)).to.be.true;
    });
  });
});