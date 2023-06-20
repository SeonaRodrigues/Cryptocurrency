import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  InputGroup,
  InputRightAddon,
  Stack,
  useToast
} from '@chakra-ui/react';
import { Web3Provider } from '@ethersproject/providers';
import { useWeb3React } from '@web3-react/core';
import { Contract, Signer } from 'ethers';
import { useEffect, useState } from 'react';

import BasicDutchAuctionArtifact from '../artifacts/contracts/BasicDutchAuction.sol/BasicDutchAuction.json';

export default function Bid() {
  const [winner, setWinner] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [valid, setValid] = useState<boolean>(false);
  const toast = useToast();

  const { active, library } = useWeb3React<Web3Provider>();
  const [signer, setSigner] = useState<Signer>();
  const [basicDutchAuctioContractAddr, setBasicDutchAuctionContractAddr] =
    useState<string>('');

  useEffect((): void => {
    if (!library) {
      setSigner(undefined);
      return;
    }

    setSigner(library.getSigner());
  }, [library]);

  return (
    <Stack direction="column" spacing="6">
      <Heading as="h2" color="green.300" fontStyle={'italic'}>Send Bids</Heading>
      <form onSubmit={handleSubmitBid}>
        <FormControl isRequired>
          <FormLabel>Auction Address</FormLabel>
          <Input
            variant="outline"
            bg={valid ? 'green.100' : 'red.100'}
            type="text"
            width="28rem"
            value={basicDutchAuctioContractAddr}
            onChange={(event) =>
              setBasicDutchAuctionContractAddr(event.target.value)
            }
          />
          <FormHelperText>
            Enter the address of the Basic Dutch Auction Smart Contract
          </FormHelperText>
        </FormControl>

        <FormControl mt={6} isRequired>
          <FormLabel>Bid Price</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'gray.200'}
              type="number"
              width="23rem"
              value={bidPrice}
              onChange={(event) => setBidPrice(event.target.value)}
            />
            <InputRightAddon bg="green.200" children="WEI"  width="5rem"/>
          </InputGroup>
          <FormHelperText>
            Enter your bidding price for the basic dutch auction in wei.
          </FormHelperText>
        </FormControl>

        <Button
          variant="solid"
          mt={6}
          colorScheme="purple"
          type="submit"
          width="10rem"
          isDisabled={!active}
        >
          Send Bid
        </Button>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Auction Winner</FormLabel>
          <Input
            variant="outline"
            bg={valid ? 'green.100' : 'red.100'}
            type="text"
            width="28rem"
            value={winner}
          />
          <FormHelperText>
            Address of the winner of the auction. Will be the zero address if
            there is no winner.
          </FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Current Price</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'red.100'}
              type="number"
              width="23rem"
              value={currentPrice}
            />
            <InputRightAddon bg="green.200" children="WEI" width="5rem"/>
          </InputGroup>
          <FormHelperText>
            Current price of the Auctioned item in wei as per dutch auction
          </FormHelperText>
        </FormControl>
      </form>
    </Stack>
  );

  async function handleSubmitBid(event: any) {
    event.preventDefault();

    // only deploy the Greeter contract one time, when a signer is defined
    if (!signer) {
      setValid(false);
      return;
    }

    const _basicDutchAuctionContract = new Contract(
      basicDutchAuctioContractAddr,
      BasicDutchAuctionArtifact.abi,
      signer
    );

    try {
      const sendBidTxn = await _basicDutchAuctionContract.connect(signer).bid({
        value: bidPrice
      });

      await sendBidTxn.wait();
      const _winner = await _basicDutchAuctionContract?.winner();
      const _currentPrice = await _basicDutchAuctionContract?.getCurrentPrice();

      if (_currentPrice?.toString() !== currentPrice) {
        setCurrentPrice(_currentPrice?.toString());
      }

      if (_winner !== winner) {
        setWinner(_winner);
      }

      setBasicDutchAuctionContractAddr(_basicDutchAuctionContract.address);
      setValid(true);

      toast({
        title: 'Bid successful',
        description: `Successfully sent a bid of ${bidPrice} to Basic Dutch Auction contract deployed at address ${_basicDutchAuctionContract.address}`,
        status: 'success',
        duration: 9000,
        isClosable: true
      });
    } catch (error: any) {
      setValid(false);
      //   console.log(error);
      setWinner('');
      setCurrentPrice('');
      toast({
        title: 'Error while sending bid',
        description: error?.reason,
        status: 'error',
        duration: 9000,
        isClosable: true
      });
    }
  }
}
