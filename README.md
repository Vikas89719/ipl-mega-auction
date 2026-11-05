# IPL Mega Auction — 2-player online starter

A browser-based, real-time auction starter using Node.js, Express and Socket.IO.

## What is included
- Create a private 6-character room code; a second player joins from another device.
- Two franchise owners choose different IPL franchise names.
- ₹120 Cr starting purse each.
- Live bidding, ₹0.25 Cr minimum increments, sold/unsold results.
- 25-player squad cap and 8 overseas-player cap.
- Server validates bids and deducts the winning price.
- Responsive dark auction interface.

## Run on your laptop
1. Install Node.js 18 or newer from https://nodejs.org/
2. Extract this ZIP.
3. Open a terminal in the extracted `ipl_mega_auction` folder.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000 in Chrome.

To test two players on one laptop, open the URL in two separate browser windows (or one normal and one incognito window).

## Let a friend join online
The app needs to be deployed to a public Node.js host that supports WebSockets (for example, Render, Railway, or another Node host).
- Push this folder to a Git repository.
- Create a **Web Service** from that repository.
- Build command: `npm install`
- Start command: `npm start`
- The host will provide a public HTTPS URL. Share that URL; create a room and send your friend the room code.

Do not deploy the current in-memory version as a serious public service without adding persistent storage, reconnection handling, room expiry, rate limiting and account/room access controls. A server restart clears active rooms.

## Important demo limitations
- The supplied player pool contains fictional sample players and sample base prices.
- This is a working multiplayer starter, not a deployed public website. I cannot create hosting accounts or deploy it without your chosen hosting account/access.
- The auction currently uses a manual **Close bidding** action by the room creator rather than a timed countdown.
- A disconnected player cannot yet reclaim their seat automatically; reconnect support is a next implementation step.
- Squad rules are simplified: 25 maximum, 8 overseas maximum. The minimum squad size is not enforced during bidding because the demo pool is intentionally small.

## Customizing players
Edit `PLAYER_POOL` near the top of `server.js`. Each player needs:
```js
{ id: "P021", name: "Player Name", role: "Batter", country: "India", base: 2 }
```
`country` must be `India` or `Overseas`; base price is in crore.
