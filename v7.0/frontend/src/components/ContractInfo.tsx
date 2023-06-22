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

export default function ContractInfo() {
  const [reservePrice, setReservePrice] = useState('');
  const [auctionDuration, setAuctionDuration] = useState('');
  const [decrementPerBlock, setDecrementPerBlock] = useState('');
  const [initialPrice, setInitialPrice] = useState('');
  const [owner, setOwner] = useState('');
  const [winner, setWinner] = useState('');
  const [startBlock, setStartBlock] = useState('');
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
      <Heading as="h2" color="green.300" fontStyle={'italic'}>Auction Contract Information</Heading>
      <form onSubmit={handleSubmit}>
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
            Please enter the address of the Basic Dutch Auction Smart Contract
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
          Show Info
        </Button>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Auction Owner</FormLabel>
          <Input
            variant="outline"
            bg={valid ? 'green.100' : 'gray.200'}
            type="text"
            width="28rem"
            value={owner}
          />
          <FormHelperText>Address of the owner of the auction.</FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Auction Winner</FormLabel>
          <Input
            variant="outline"
            bg={valid ? 'green.100' : 'gray.200'}
            type="text"
            width="28rem"
            value={winner}
          />
          <FormHelperText>
            Address of the winner of the auction
          </FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Reserve Price</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'gray.200'}
              type="number"
              width="23rem"
              value={reservePrice}
            />
            <InputRightAddon bg="green.200" children="WEI"  width="5rem" />
          </InputGroup>
          <FormHelperText>
            Lowest price of the Auctioned item in wei.
          </FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Start Block</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'gray.200'}
              type="number"
              width="23rem"
              value={startBlock}
            />
            <InputRightAddon bg="green.200" children="BLOCK"  width="5rem"/>
          </InputGroup>
          <FormHelperText>
            Number of the block auction started at.
          </FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Auction Duration</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'gray.200'}
              type="number"
              width="23rem"
              value={auctionDuration}
              onChange={(event) => setAuctionDuration(event.target.value)}
            />
            <InputRightAddon bg="green.200" children="BLOCKS"  width="5rem" />
          </InputGroup>
          <FormHelperText>
            Number of blocks the auction remains open
          </FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Decrement per block</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'gray.200'}
              type="number"
              width="23rem"
              value={decrementPerBlock}
            />
            <InputRightAddon bg="green.200" children="WEI" width="5rem" />
          </InputGroup>
          <FormHelperText>Decrement in offer price per block</FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Initial Price</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'gray.200'}
              type="number"
              width="23rem"
              value={initialPrice}
            />
            <InputRightAddon bg="green.200" children="WEI"  width="5rem"/>
          </InputGroup>
          <FormHelperText>
            Starting price of the Auctioned item in wei as per dutch auction
          </FormHelperText>
        </FormControl>

        <FormControl mt={6} isReadOnly>
          <FormLabel>Current Price</FormLabel>
          <InputGroup>
            <Input
              variant="outline"
              bg={valid ? 'green.100' : 'gray.200'}
              type="number"
              width="23rem"
              value={currentPrice}
            />
            <InputRightAddon bg="green.200" children="WEI"  width="5rem"/>
          </InputGroup>
          <FormHelperText>
            Current price of the Auctioned item in wei as per dutch auction
          </FormHelperText>
        </FormControl>
      </form>
    </Stack>
  );

  async function handleSubmit(event: any) {
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
      const _reservePrice = await _basicDutchAuctionContract?.reservePrice();
      const _initialPrice = await _basicDutchAuctionContract?.initialPrice();
      const _owner = await _basicDutchAuctionContract?.owner();
      const _winner = await _basicDutchAuctionContract?.winner();
      const _currentPrice = await _basicDutchAuctionContract?.getCurrentPrice();
      const _startBlock = await _basicDutchAuctionContract?.startBlock();
      const _decrementPerBlock =
        await _basicDutchAuctionContract?.offerPriceDecrement();
      const _auctionDuration =
        await _basicDutchAuctionContract?.numBlocksAuctionOpen();

      if (_reservePrice?.toString() !== reservePrice) {
        setReservePrice(_reservePrice?.toString());
      }

      if (_initialPrice?.toString() !== initialPrice) {
        setInitialPrice(_initialPrice?.toString());
      }

      if (_currentPrice?.toString() !== currentPrice) {
        setCurrentPrice(_currentPrice?.toString());
      }

      if (_startBlock?.toString() !== startBlock) {
        setStartBlock(_startBlock?.toString());
      }

      if (_auctionDuration?.toString() !== auctionDuration) {
        setAuctionDuration(_auctionDuration?.toString());
      }

      if (_decrementPerBlock?.toString() !== decrementPerBlock) {
        setDecrementPerBlock(_decrementPerBlock?.toString());
      }

      if (_owner !== owner) {
        setOwner(_owner);
      }

      if (_winner !== winner) {
        setWinner(_winner);
      }

      setBasicDutchAuctionContractAddr(_basicDutchAuctionContract.address);
      setValid(true);
      toast({
        title: 'Fetch successful',
        description: `Fetched details from Basic Dutch Auction contract deployed to address ${_basicDutchAuctionContract.address}`,
        status: 'info',
        duration: 9000,
        isClosable: true
      });
    } catch (error: any) {
      setValid(false);
      setOwner('');
      setWinner('');
      setReservePrice('');
      setStartBlock('');
      setAuctionDuration('');
      setDecrementPerBlock('');
      setInitialPrice('');
      setCurrentPrice('');
      toast({
        title: 'Error while fetching Auction contract details',
        description: error?.message?.substring(0, 120),
        status: 'error',
        duration: 9000,
        isClosable: true
      });
    }
  }
}
