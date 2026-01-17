# NFTBidCollection Smart Contract Documentation

The `NFTBidCollection` is an ERC721-compliant smart contract designed for the NFT Bid Marketplace. It facilitates NFT minting and integrated auction functionality on the blockchain.

## Deployment Details

- **Network**: Primarily configured for **Polygon Amoy Testnet**.
- **Alternative Network**: **Sepolia Testnet**.
- **Standard**: ERC721 with URI Storage and Ownable access control.

## Contract Methods

### Write Methods (Transactions)

| Method | Access | Description |
| :--- | :--- | :--- |
| `mintNFT(address to, string _tokenURI)` | `onlyOwner` | Mints a new NFT to the specified address with a unique metadata URI. Returns the `tokenId`. |
| `createAuction(uint256 tokenId, uint256 startingPrice, uint256 startTime, uint256 endTime)` | Public | Creates an auction for a owned NFT. The NFT is escrowed in the contract during the auction. |
| `placeBid(uint256 tokenId)` | Public | Places a bid on an active auction. Requires sending ETH/MATIC greater than the current highest bid. Previous bidders are automatically refunded. |
| `endAuction(uint256 tokenId)` | Public | Ends an auction after the `endTime` has passed. Transfers the NFT to the winner and funds to the seller. If no bids, the NFT is returned to the seller. |
| `cancelAuction(uint256 tokenId)` | Public | Cancels an active auction if no bids have been placed yet. Returns the NFT to the seller. |

### Read Methods (Calls)

| Method | Description |
| :--- | :--- |
| `getAuction(uint256 tokenId)` | Returns detailed auction information: `seller`, `highestBid`, `highestBidder`, `endTime`, and `active` status. |
| `auctions(uint256)` | Public mapping to access the `Auction` struct details directly. |
| `ownerOf(uint256 tokenId)` | Returns the current owner of the specified NFT. |
| `tokenURI(uint256 tokenId)` | Returns the metadata URI associated with the NFT. |

## Events

The contract emits the following events to facilitate off-chain tracking (e.g., by the `BlockchainListenerService`):

- `Minted(address indexed to, uint256 tokenId, string tokenURI)`
- `AuctionCreated(uint256 indexed tokenId, address indexed seller, uint256 startingPrice, uint256 startTime, uint256 endTime)`
- `BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount)`
- `AuctionEnded(uint256 indexed tokenId, address winner, uint256 amount)`
- `AuctionCanceled(uint256 indexed tokenId)`

## Workflow Example

1. **Minting**: Admin calls `mintNFT` to create a new asset.
2. **Auction Setup**: User (owner) calls `createAuction` providing timing and price details.
3. **Bidding**: Multiple users call `placeBid` with increasing values.
4. **Resolution**: Once expired, anyone can call `endAuction` to settle the trade.
