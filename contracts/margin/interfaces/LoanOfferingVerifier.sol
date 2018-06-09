/*

    Copyright 2018 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity 0.4.24;
pragma experimental "v0.5.0";


/**
 * @title LoanOfferingVerifier
 * @author dYdX
 *
 * Interface that smart contracts must implement to be able to make off-chain generated
 * loan offerings.
 *
 * NOTE: Any contract implementing this interface should also use OnlyMargin to control access
 *       to these functions
 */
contract LoanOfferingVerifier {

    // ============ Structs ============

    struct LoanOffering {
        address owedToken;
        address heldToken;
        address payer;
        address signer;
        address owner;
        address taker;
        address positionOwner;
        address feeRecipient;
        address lenderFeeToken;
        address takerFeeToken;
        uint256 maximumAmount;
        uint256 minimumAmount;
        uint256 minimumHeldToken;
        uint256 lenderFee;
        uint256 takerFee;
        uint256 expirationTimestamp;
        uint256 salt;
        uint32  callTimeLimit;
        uint32  maxDuration;
        uint32  interestRate;
        uint32  interestPeriod;
    }

    // ============ Margin-Only State-Changing Functions ============

    /**
     * Function a smart contract must implement to be able to consent to a loan. The loan offering
     * will be generated off-chain and signed by a signer. The Margin contract will verify that
     * the signature for the loan offering was made by signer. The "loan owner" address will own the
     * loan-side of the resulting position.
     *
     * If true is returned, and no errors are thrown by the Margin contract, the loan will have
     * occurred. This means that verifyLoanOffering can also be used to update internal contract
     * state on a loan.
     *
     * @param  addresses    Array of addresses:
     *
     *  [0] = owedToken
     *  [1] = heldToken
     *  [2] = loan payer
     *  [3] = loan signer
     *  [4] = loan owner
     *  [5] = loan taker
     *  [6] = loan fee recipient
     *  [7] = loan lender fee token
     *  [8] = loan taker fee token
     *
     * @param  values256    Values corresponding to:
     *
     *  [0] = loan maximum amount
     *  [1] = loan minimum amount
     *  [2] = loan minimum heldToken
     *  [3] = loan lender fee
     *  [4] = loan taker fee
     *  [5] = loan expiration timestamp (in seconds)
     *  [6] = loan salt
     *
     * @param  values32     Values corresponding to:
     *
     *  [0] = loan call time limit (in seconds)
     *  [1] = loan maxDuration (in seconds)
     *  [2] = loan interest rate (annual nominal percentage times 10**6)
     *  [3] = loan interest update period (in seconds)
     *
     * @param  positionId   Unique ID of the position
     * @return              This address to accept, a different address to ask that contract
     */
    function verifyLoanOffering(
        address[10] addresses,
        uint256[7] values256,
        uint32[4] values32,
        bytes32 positionId
    )
        external
        /* onlyMargin */
        returns (address);

    // ============ Parsing Functions ============

    function parseLoanOffering(
        address[10] addresses,
        uint256[7] values256,
        uint32[4] values32
    )
        internal
        pure
        returns (LoanOffering memory)
    {
        LoanOffering memory loanOffering;

        fillLoanOfferingAddresses(loanOffering, addresses);
        fillLoanOfferingValues256(loanOffering, values256);
        fillLoanOfferingValues32(loanOffering, values32);

        return loanOffering;
    }

    function fillLoanOfferingAddresses(
        LoanOffering memory loanOffering,
        address[10] addresses
    )
        private
        pure
    {
        loanOffering.owedToken = addresses[0];
        loanOffering.heldToken = addresses[1];
        loanOffering.payer = addresses[2];
        loanOffering.signer = addresses[3];
        loanOffering.owner = addresses[4];
        loanOffering.taker = addresses[5];
        loanOffering.positionOwner = addresses[6];
        loanOffering.feeRecipient = addresses[7];
        loanOffering.lenderFeeToken = addresses[8];
        loanOffering.takerFeeToken = addresses[9];
    }

    function fillLoanOfferingValues256(
        LoanOffering memory loanOffering,
        uint256[7] values256
    )
        private
        pure
    {
        loanOffering.maximumAmount = values256[0];
        loanOffering.minimumAmount = values256[1];
        loanOffering.minimumHeldToken = values256[2];
        loanOffering.lenderFee = values256[3];
        loanOffering.takerFee = values256[4];
        loanOffering.expirationTimestamp = values256[5];
        loanOffering.salt = values256[6];
    }

    function fillLoanOfferingValues32(
        LoanOffering memory loanOffering,
        uint32[4] values32
    )
        private
        pure
    {
        loanOffering.callTimeLimit = values32[0];
        loanOffering.maxDuration = values32[1];
        loanOffering.interestRate = values32[2];
        loanOffering.interestPeriod = values32[3];
    }
}
