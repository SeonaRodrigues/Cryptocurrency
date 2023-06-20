import {
  Box,
  Container,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs
} from '@chakra-ui/react';
import Header from './components/Header';
import Deployment from './components/Deployment';
import ContractInfo from './components/ContractInfo';
import Bid from './components/Bid';

function App() {
  return (
    <Box bg="gray.900" minHeight="100%" py={8}>
      <Container bg="blue.100" maxW="5xl" rounded="2xl" minHeight="90vh">
        <Header />
        <Tabs isFitted variant="enclosed-colored">
          <TabList mb="1em">
            <Tab>Deployment</Tab>
            <Tab>Contract Info</Tab>
            <Tab>Bid</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Deployment />
            </TabPanel>
            <TabPanel>
              <ContractInfo />
            </TabPanel>
            <TabPanel>
              <Bid />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Container>
    </Box>
  );
}

export default App;
