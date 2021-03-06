const CrowdfyContract = artifacts.require('./Crowdfy.sol');
const CrowdfyFabricContract = artifacts.require('./CrowdfyFabric');


contract('Crowdfy', (accounts) => {
    let contractFactory;
    let contract;
    const userCampaignCreator = accounts[0];
    const contractImplementationCreator = accounts[1];
    const beneficiary = accounts[2];
    const contributor1 = accounts[3];
    const contributor2 = accounts[4];


    const STATE = {
        ongoing: 0,
        failed: 1,
        succed: 2,
        paidOut: 3,
        earlySuccess: 4
    };

    const CREATION_TIME = 1686614159;
    const ONE_ETH = 1000000000000000000;
    const ERR_MSG = "Not Permited during this state of the campaign."

    //     //allows us to destruct the campaign struct
    const destructCampaign = (struct) => {
        const { campaignName, fundingGoal, fundingCap, deadline, beneficiary, owner, created, state, amountRised } = struct;

        return {
            campaignName,
            fundingGoal: Number(fundingGoal),
            fundingCap: Number(fundingCap),
            deadline: Number(deadline),
            beneficiary,
            owner,
            created: Number(created),
            state: Number(state),
            amountRised: Number(amountRised)
        }
    };

    //allows us to destruct the contribution struct
    const destructContribution = contribution => {
        const { sender, value, time, numberOfContributions, hasContribute } = contribution;

        return {
            sender,
            value: Number(value),
            time,
            numberOfContributions: Number(numberOfContributions),
            hasContribute
        }
    }

    beforeEach(async () => {

        contractFactory = await CrowdfyFabricContract.new(
            {
                from: contractImplementationCreator
            }
        )

        await contractFactory.createCampaign(
            "My Campaign",
            String(ONE_ETH),
            CREATION_TIME,
            String(ONE_ETH),
            beneficiary,
            { from: userCampaignCreator }
        );

        contract = await CrowdfyContract.at(await contractFactory.campaignsById(0));

    })
    //  ((1 / 100) * (ONE_ETH + ONE_ETH)) NOTICE: this comes from the fee that takes for every contribution 1% that goes to the protocol owner(me)


    it("contract should be initialized correctly", async () => {


        const campaignStruct = await contract.theCampaign.call()

        const destructuredCampaign = destructCampaign(campaignStruct);
        expect(destructuredCampaign.campaignName).to.equal('My Campaign');
        expect(destructuredCampaign.fundingGoal).to.equal(ONE_ETH);
        expect(destructuredCampaign.fundingCap).to.equal(ONE_ETH);
        expect(destructuredCampaign.deadline).to.equal(CREATION_TIME)
        expect(destructuredCampaign.beneficiary).to.equal(beneficiary);
        expect(destructuredCampaign.owner).to.equal(userCampaignCreator);

        expect(destructuredCampaign.state.valueOf()).to.equal(STATE.ongoing);
        expect(destructuredCampaign.amountRised).to.equal(0);

    });

    it("should not allowed to initialize the campaign from inside", async () => {

        try {
            await contract.initializeCampaign(
                "My Campaign",
                1,
                CREATION_TIME,
                1,
                accounts[6],
                accounts[7],
                accounts[6],
                { from: contributor2 }
            )
            expect.fail()
        }
        catch (err) {


        }
        try {
            await contract.initializeCampaign(
                "My Campaign",
                1,
                CREATION_TIME,
                1,
                accounts[6],
                accounts[7],
                accounts[6],
                { from: contributor2 }
            )
            expect.fail()
        }
        catch (err) {
        }
    })

    describe('contributions', async () => {

        it("should contribute founds", async () => {

            let campaignStruct = await contract.theCampaign.call()

            let destructuredCampaign = destructCampaign(campaignStruct);

            expect(destructuredCampaign.amountRised).to.equal(0)

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 2
                });

            campaignStruct = await contract.theCampaign.call()
            destructuredCampaign = destructCampaign(campaignStruct)

            expect(destructuredCampaign.amountRised).to.equal((ONE_ETH / 2) - ((1 / 100) * ONE_ETH / 2))

            const contributions = await contract.contributions.call(0);
            let contributionDestructured = destructContribution(contributions);
            expect(contributionDestructured.sender).to.equal(contributor1);
            expect(contributionDestructured.value).to.equal((ONE_ETH / 2) - ((1 / 100) * ONE_ETH / 2));
            expect(contributionDestructured.numberOfContributions).to.equal(1);


        })

        it('should not allowed to contribute 0 < ', async () => {
            try {
                await contract.contribute(
                    {
                        from: contributor1,
                        value: 0
                    });
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal("Put a correct amount");
            }
        })

        it("should not contribute during succes state", async () => {

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH + ONE_ETH
                });

            let campaignStruct = await contract.theCampaign.call()

            let campaignDestructured = destructCampaign(campaignStruct);


            try {
                await contract.contribute(
                    {
                        from: contributor1,
                        value: ONE_ETH - 200000000
                    });

                expect.fail()
            } catch (err) {
                expect(campaignDestructured.state).to.equal(STATE.succed)
            }
        })

        it("should not contribute after deadline", async () => {
            await contract.setDate({ from: userCampaignCreator });

            try {
                await contract.contribute(
                    {
                        from: contributor1,
                        value: ONE_ETH - 200000000
                    });
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal(ERR_MSG);
            }
        })
        it('should have multiple contrubitions', async () => {
            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 4
                });

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 4
                });

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 4
                });

            await contract.contribute(
                {
                    from: contributor2,
                    value: ONE_ETH / 4
                });


            const contributions = await contract.contributionsByPeople.call(contributor1);
            let contributionDestructured = destructContribution(contributions);

            expect(contributionDestructured.sender).to.equal(contributor1);
            expect(contributionDestructured.value).to.equal(750000000000000000 - (1 / 100) * 750000000000000000);
            expect(contributionDestructured.numberOfContributions).to.equal(3);

            // const allContributions = await contract.contributions.call(3)

        })
    })

    describe('State', async () => {
        it('should pass to state = succeded', async () => {

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH + ONE_ETH
                });


            let campaignStruct = await contract.theCampaign.call()

            let campaignDestructured = destructCampaign(campaignStruct);

            expect(campaignDestructured.amountRised).to.equal(ONE_ETH + ONE_ETH - ((1 / 100) * (ONE_ETH + ONE_ETH)))
            expect(campaignDestructured.state).to.equal(STATE.succed)
        })

        it('should pass to failed state', async () => {

            let campaignStruct;
            let campaignDestructured;
            let amount = 250000000000000000;

            await contract.contribute(
                {
                    from: contributor1,
                    value: amount
                });
            await contract.contribute(
                {
                    from: contributor1,
                    value: amount
                });
            await contract.contribute(
                {
                    from: contributor1,
                    value: amount
                });

            await contract.setDate({ from: userCampaignCreator });
            try {
                await contract.contribute(
                    {
                        from: contributor1,
                        value: amount
                    });
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal(ERR_MSG);
            }
            try {
                await contract.withdraw({ from: beneficiary })
                campaignStruct = await contract.theCampaign.call()
                campaignDestructured = destructCampaign(campaignStruct);
                expect(campaignDestructured.state).to.equal(STATE.failed)
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal(ERR_MSG);
            }

            campaignStruct = await contract.theCampaign.call()
            campaignDestructured = destructCampaign(campaignStruct);

            expect(campaignDestructured.amountRised).to.equal(750000000000000000 - ((1 / 100) * 750000000000000000))
        })

        it('should keep in ongoing state', async () => {
            let campaignStruct;
            let campaignDestructured;
            let amount = 250000000000000000;


            await contract.contribute(
                {
                    from: contributor1,
                    value: amount
                });


            campaignStruct = await contract.theCampaign.call()
            campaignDestructured = destructCampaign(campaignStruct);

            expect(campaignDestructured.amountRised).to.equal(amount - ((1 / 100) * amount))
            expect(campaignDestructured.state).to.equal(STATE.ongoing)
            await contract.contribute(
                {
                    from: contributor1,
                    value: amount
                });
            campaignStruct = await contract.theCampaign.call()
            campaignDestructured = destructCampaign(campaignStruct);

            expect(campaignDestructured.amountRised).to.equal(amount + amount - ((1 / 100) * 500000000000000000))
            expect(campaignDestructured.state).to.equal(STATE.ongoing)
            await contract.contribute(
                {
                    from: contributor1,
                    value: amount
                });

            campaignStruct = await contract.theCampaign.call()
            campaignDestructured = destructCampaign(campaignStruct);

            expect(campaignDestructured.amountRised).to.equal(amount + amount + amount - ((1 / 100) * 750000000000000000))
            expect(campaignDestructured.state).to.equal(STATE.ongoing)
            await contract.contribute(
                {
                    from: contributor1,
                    value: amount + amount
                });

            campaignStruct = await contract.theCampaign.call()
            campaignDestructured = destructCampaign(campaignStruct);

            expect(campaignDestructured.amountRised).to.equal((ONE_ETH + amount) - ((1 / 100) * (ONE_ETH + amount)))
            expect(campaignDestructured.state).to.equal(STATE.succed)
        })

    })

    describe('Withdraw', async () => {
        it('should allow the beneficiary withdraw during succes state', async () => {


            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH + ONE_ETH
                });

            let balanceinicial = await web3.eth.getBalance(beneficiary)

            let campaignStruct = await contract.theCampaign.call()
            let campaignDestructured = destructCampaign(campaignStruct);

            expect(campaignDestructured.amountRised).to.equal(ONE_ETH + ONE_ETH - ((1 / 100) * (ONE_ETH + ONE_ETH)))

            expect(campaignDestructured.state).to.equal(STATE.succed)
            let gas = await contract.withdraw.estimateGas({ from: beneficiary });
            let txInfo = await contract.withdraw({ from: beneficiary })

            const tx = await web3.eth.getTransaction(txInfo.tx);

            let balanceFinal = await web3.eth.getBalance(beneficiary)

            expect(
                (balanceFinal - balanceinicial) +
                (tx.gasPrice * gas)
            ).to.equal(
                (ONE_ETH + ONE_ETH) -
                ((1 / 100) * (ONE_ETH + ONE_ETH))) // the fee that was send to the owner of the protocol (me))

        })

        it('should not allowed the beneficiary withdraw during ongoing state of the campaign', async () => {

            await contract.contribute(
                {
                    from: contributor1,
                    value: 250000000000000000
                });

            try {
                await contract.withdraw({ from: beneficiary })
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal(ERR_MSG)
            }

        })

        it('should not allow the beneficiary withdraw during fail state', async () => {

            await contract.contribute(
                {
                    from: contributor1,
                    value: 250000000000000000
                });

            await contract.setDate({ from: userCampaignCreator });

            try {
                await contract.withdraw({ from: beneficiary })
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal(ERR_MSG)
            }

        })

        it('should not allow others to withdraw', async () => {

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 2
                });

            await contract.contribute(
                {
                    from: contributor2,
                    value: ONE_ETH
                });

            try {
                await contract.withdraw({ from: contributor1 })
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal("Only the beneficiary can call this function")
            }


            try {
                await contract.withdraw({ from: contributor2 })
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal("Only the beneficiary can call this function")
            }


            try {
                await contract.withdraw({ from: userCampaignCreator })
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal("Only the beneficiary can call this function")
            }

            try {
                await contract.withdraw({ from: contractImplementationCreator })
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal("Only the beneficiary can call this function")
            }
        })

    })

    describe('Refunding', async () => {
        it('should allow contributors to refound in case of failure', async () => {

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 4
                });

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 4
                });

            await contract.contribute(
                {
                    from: contributor2,
                    value: ONE_ETH / 4
                });

            await contract.setDate({ from: userCampaignCreator });
            const balance1Inicial = await web3.eth.getBalance(contributor1)
            const balance2Inicial = await web3.eth.getBalance(contributor2)

            let gasUsed = await contract.claimFounds.estimateGas({ from: contributor1 })
            await contract.claimFounds({ from: contributor1 })

            // let txInfo2 = await contract.claimFounds({ from: contributor2 })

            // const tx1 = await web3.eth.getTransaction(txInfo1.tx);
            // const tx2 = await web3.eth.getTransaction(txInfo2.tx);

            const balance1Final = await web3.eth.getBalance(contributor1)
            const balance2Final = await web3.eth.getBalance(contributor2)

            let gasPrice = await web3.eth.getGasPrice()

            // //NOTICE = idk where those 6144 and 16384 come from
            // expect(
            //     (balance1Final - balance1Inicial) + (gasPrice * gasUsed)).to.equal(500000000000000000)

            // // expect(
            // //     (balance2Final - balance2Inicial) + (gasPrice * gasUsed)
            // //     ).to.equal(250000000000000000 + 16384 - 6144)
        })

        it('should not allowed others to refund', async () => {

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 3
                });


            await contract.contribute(
                {
                    from: contributor2,
                    value: ONE_ETH / 3
                });

            await contract.setDate({ from: userCampaignCreator });

            try {
                await contract.claimFounds({ from: beneficiary })
                expect.fail()

            }
            catch (error) {
                expect(error.reason).to.equal('You didnt contributed')
            }
            try {
                await contract.claimFounds({ from: accounts[6] })
                expect.fail()

            }
            catch (error) {
                expect(error.reason).to.equal('You didnt contributed')
            }

        })

        it('should not allowed to refound twice', async () => {
            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 3
                });
            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 3
                });

            await contract.setDate({ from: userCampaignCreator });

            await contract.claimFounds({ from: contributor1 })
            try {
                await contract.claimFounds({ from: contributor1 })
                expect.fail()
            }
            catch (error) {
                expect(error.reason).to.equal("You already has been refunded")
            }
        })
        it('once refunded their contribution value should be 0', async () => {
            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 3
                });

            await contract.setDate({ from: userCampaignCreator });

            await contract.claimFounds({ from: contributor1 })
            const contribution = await contract.contributionsByPeople.call(contributor1)
            expect(Number(contribution.value)).to.equal(0)
        })
    })

    describe('Earnings', async () => {

        it("should have earnings for one contribution", async () => {
            let initialBalance = await web3.eth.getBalance(contractImplementationCreator)
            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH
                });

            let finalBalance = await web3.eth.getBalance(contractImplementationCreator)

            expect(finalBalance - initialBalance).to.equal((1 / 100) * ONE_ETH)
        })

        it("should have earnings for multiple contributions", async () => {

            let initialBalance = await web3.eth.getBalance(contractImplementationCreator)

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 4
                });

            let finalBalance = await web3.eth.getBalance(contractImplementationCreator)

            expect(finalBalance - initialBalance).to.equal((1 / 100) * ONE_ETH / 4)


            initialBalance = await web3.eth.getBalance(contractImplementationCreator)

            await contract.contribute(
                {
                    from: contributor1,
                    value: ONE_ETH / 4
                });

            finalBalance = await web3.eth.getBalance(contractImplementationCreator)

            expect(finalBalance - initialBalance).to.equal((1 / 100) * ONE_ETH / 4)

            initialBalance = await web3.eth.getBalance(contractImplementationCreator)
            await contract.contribute(
                {
                    from: accounts[8],
                    value: ONE_ETH / 4
                });


            finalBalance = await web3.eth.getBalance(contractImplementationCreator)

            expect(finalBalance - initialBalance).to.equal((1 / 100) * ONE_ETH / 4)


            initialBalance = await web3.eth.getBalance(contractImplementationCreator)

            await contract.contribute(
                {
                    from: contributor2,
                    value: ONE_ETH / 4
                });

            finalBalance = await web3.eth.getBalance(contractImplementationCreator)

            expect(finalBalance - initialBalance).to.equal((1 / 100) * ONE_ETH / 4)

        })
        it("should support high amounts of earnings", async () => {

            let initialBalance = await web3.eth.getBalance(contractImplementationCreator)
            await contract.contribute(
                {
                    from: accounts[8],
                    value: 10000000000000000000
                });
            let finalBalance = await web3.eth.getBalance(contractImplementationCreator)

            expect(finalBalance - initialBalance).to.equal((1 / 100) * 10000000000000000000)
        })

        it("should support low amounts of earnings", async () => {

            let initialBalance = await web3.eth.getBalance(contractImplementationCreator)
            await contract.contribute(
                {
                    from: accounts[8],
                    value: ONE_ETH / 10
                });
            let finalBalance = await web3.eth.getBalance(contractImplementationCreator)

            expect(finalBalance - initialBalance).to.equal((1 / 100) * ONE_ETH / 10)
        })
    })


})

