import { useEffect } from 'react';

import { useWeb3React } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import { Box, Button, useToast } from '@chakra-ui/react';
import { injected } from '../utils/connectors';
import { formatAddress } from '../utils/helpers';

const ConnectMetamask = () => {
  const { chainId, account, activate, deactivate, active, library, connector } =
    useWeb3React<Web3Provider>();

  const toast = useToast();

  const onClickConnect = () => {
    activate(
      injected,
      (error) => {
        toast({
          title: 'Error',
          description: error?.message,
          status: 'error',
          duration: 9000,
          isClosable: true
        });
      },
      false
    );
  };

  const onClickDisconnect = () => {
    deactivate();
  };

  useEffect(() => {
    console.log(chainId, account, active, library, connector);
  });

  return (
    <Box>
      {active && typeof account === 'string' ? (
        <Button
          type="button"
          colorScheme="blue"
          w="100%"
          onClick={onClickDisconnect}
        >
          Account: {formatAddress(account, 4)}
        </Button>
      ) : (
        <Button type="button" colorScheme="green" onClick={onClickConnect}>
          Connect
        </Button>
      )}
    </Box>
  );
};

export default ConnectMetamask;
