const socket = io();
const $ = id => document.getElementById(id);
let roomCode = null, mySocketId = null, roomState = null, isHost = false;
let toastTimer;
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2600)}
function franchise(){return $("franchise").value}
function money(n){return `₹${Number(n).toFixed(2)} Cr`}
function myTeam(){return roomState?.franchises.find(t=>t.id===mySocketId)}
function showRoom(){
  $("lobby").classList.add("hidden");$("auction").classList.remove("hidden");
  $("roomLabel").textContent=roomCode;
  const teams=$("teams");teams.innerHTML="";
  roomState.franchises.forEach(t=>{
    const el=document.createElement("div");el.className="team-tile";
    el.innerHTML=`<div><strong>${t.name}</strong><small>${t.squad.length} players · ${t.squad.filter(p=>p.country==="Overseas").length} overseas</small></div><b>${money(t.purse)}</b>`;
    teams.appendChild(el);
  });
  const p=roomState.players[roomState.currentIndex];
  $("remaining").textContent=Math.max(0,roomState.players.length-roomState.currentIndex);
  $("auctionTitle").textContent=roomState.status==="completed"?"Auction completed":roomState.status==="waiting"?"Waiting for second franchise":"Player bidding";
  if(p){
    $("playerName").textContent=p.name;$("playerRole").textContent=p.role;$("playerCountry").textContent=p.country;
    $("basePrice").textContent=money(p.base);$("playerNumber").textContent=`${String(roomState.currentIndex+1).padStart(2,"0")} / ${roomState.players.length}`;
    $("currentBid").innerHTML=`${money(roomState.currentBid).replace(" Cr","")} <em>Cr</em>`;
    const leader=roomState.franchises.find(t=>t.id===roomState.highestBidder);
    $("bidLeader").textContent=leader?`Leading: ${leader.name}`:"No bids yet";
  } else {
    $("playerName").textContent="Auction complete";$("playerRole").textContent="";$("playerCountry").textContent="";
    $("basePrice").textContent="—";$("currentBid").textContent="—";$("bidLeader").textContent="All players processed";
  }
  const mine=myTeam();
  $("myTeam").textContent=mine?.name||"Rejoin required";
  $("myPurse").textContent=money(mine?.purse??120);
  $("mySquadCount").textContent=`${mine?.squad.length??0} / 25`;
  $("myOverseas").textContent=`${mine?.squad.filter(p=>p.country==="Overseas").length??0} / 8`;
  $("squad").innerHTML=mine?.squad.length?mine.squad.map(p=>`<div class="squad-item"><span>${p.name}</span><span>${money(p.soldFor)}</span></div>`).join(""):'<p class="muted">No players bought yet.</p>';
  $("log").innerHTML=roomState.auctionLog.length?roomState.auctionLog.slice(0,12).map(x=>`<div class="log-item"><span>${x.player}<br><small>${x.result==="SOLD"?x.team:"Unsold"}</small></span><span class="${x.result==="SOLD"?"sold":""}">${x.result==="SOLD"?money(x.price):"—"}</span></div>`).join(""):'<p class="muted">No completed bids yet.</p>';
  const live=roomState.status==="live"&&p;
  $("bidBtn").disabled=!live||roomState.highestBidder===mySocketId;
  $("closeBtn").disabled=!live||!isHost;
  $("startBtn").classList.toggle("hidden",!(roomState.status==="waiting"&&isHost));
  if(roomState.status==="waiting") $("auctionTitle").textContent="Waiting for auction to start";
}
$("createBtn").onclick=()=>socket.emit("room:create",{franchise:franchise()});
$("joinBtn").onclick=()=>socket.emit("room:join",{code:$("roomCode").value,franchise:franchise()});
$("startBtn").onclick=()=>socket.emit("auction:start",{code:roomCode});
$("bidBtn").onclick=()=>{
  const p=roomState?.players[roomState.currentIndex];if(!p)return;
  const amount=roomState.currentBid===0?p.base:Number((roomState.currentBid+.25).toFixed(2));
  socket.emit("bid:place",{code:roomCode,amount});
};
$("closeBtn").onclick=()=>socket.emit("auction:close",{code:roomCode});
socket.on("connect",()=>{mySocketId=socket.id});
socket.on("room:joined",data=>{
  roomCode=data.code;mySocketId=data.teamId;isHost=!!roomState?.hostId&&roomState.hostId===mySocketId;
  $("roomInfo").classList.remove("hidden");$("roomInfo").innerHTML=`Share this room code with your friend:<br><b>${roomCode}</b>`;
  $("startBtn").classList.toggle("hidden",!isHost);
  toast("Joined room "+roomCode);
});
socket.on("room:update",state=>{
  const previous=roomState;roomState=state;
  isHost=state.hostId===mySocketId;
  if(roomState.status!=="waiting"||roomState.franchises.length===2) showRoom();
  else {
    $("roomInfo").classList.remove("hidden");
    $("roomInfo").innerHTML=`Share this room code with your friend:<br><b>${roomCode||state.code}</b><br><small>Waiting for second player…</small>`;
    $("startBtn").classList.toggle("hidden",!isHost);
  }
  if(previous&&previous.currentIndex!==state.currentIndex&&state.currentIndex>previous.currentIndex)toast("Next player is up for bidding.");
});
socket.on("app:error",toast);
socket.on("notice",toast);
