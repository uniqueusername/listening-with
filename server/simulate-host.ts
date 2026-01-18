// host simulator to keep a room open for web client testing
// usage: bun run simulate-host.ts

const ws = new WebSocket("ws://localhost:2946/ws");

ws.onopen = () => {
  console.log("connected to server");
  ws.send(JSON.stringify({ type: "create_room" }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === "room_created") {
    console.log("\n--- room created for testing ---");
    console.log(`code: ${data.code}`);
    console.log(`link: http://localhost:4321/join/${data.code}`);
    console.log("\nkeep this process running to keep the room alive.");
    
    // send heartbeats every 30s to prevent timeout
    setInterval(() => {
      ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 30000);
  }

  if (data.type === "song_added") {
    console.log(`\nsong added to queue: "${data.song.title}" by ${data.song.artist}`);
    console.log(`submitted by: ${data.song.submittedBy || "anonymous"}`);
    console.log(`queue length: ${data.queueLength}`);
  }

  if (data.type === "client_joined") {
    console.log(`\nclient joined: ${data.displayName || "anonymous"} (${data.clientId})`);
    console.log(`total clients: ${data.clientCount}`);
  }
  
  if (data.type === "client_left") {
    console.log(`\nclient left (${data.clientId})`);
    console.log(`total clients: ${data.clientCount}`);
  }

  if (data.type === "error") {
    console.error("error:", data.message);
  }
};

ws.onclose = (event) => {
  console.log(`connection closed: code=${event.code}, reason=${event.reason}`);
  process.exit(0);
};