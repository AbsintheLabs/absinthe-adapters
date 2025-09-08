//todo: conceptual: this will be easily adjusted in our openPosition mapping, we will work on this after having testing of our current code

// 1. InitializePositionBundle

// - Purpose:
// Creates a new, empty position bundle (an NFT that will represent the bundle).
// - What happens:
// 	- A new bundle account is created on-chain.
// 	- A new NFT (the “bundle NFT”) is minted to represent ownership of the bundle.
// 	- The bundle is now ready to have positions added to it.
// - Who uses it:
// Anyone who wants to start managing multiple positions as a group.

// ---

// 2. InitializePositionBundleWithMetadata

// - Purpose:
// Same as above, but also attaches on-chain metadata (e.g., name, description, image) to the bundle NFT.
// - What happens:
// 	- Same as InitializePositionBundle, but also creates a metadata account.
// 	- Useful for protocols or DAOs that want to label or brand their bundles.

// ---

// 3. DeletePositionBundle

// - Purpose:
// Permanently deletes a position bundle.
// - What happens:
// 	- The bundle account and its NFT are closed/burned.
// 	- Any remaining SOL in the account is sent to a specified receiver.
// 	- Note: All bundled positions must be closed or removed before deletion.

// ---

// 4. OpenBundledPosition

// - Purpose:
// Opens (creates) a new position inside a bundle.
// - What happens:
// 	- A new position (with its own tick range and liquidity) is created and added to the bundle.
// 	- The position is associated with a specific “slot” or “index” in the bundle.
// 	- The bundle owner controls all positions inside the bundle.
// - Why use it:
// 	- Efficiently manage many positions (e.g., for grid strategies, rebalancing, or protocol incentives).

// ---

// 5. CloseBundledPosition

// - Purpose:
// Closes (removes) a position from the bundle.
// - What happens:
// 	- The specified position is closed, and any remaining tokens are returned to the owner.
// 	- The slot in the bundle becomes empty and can be reused.
