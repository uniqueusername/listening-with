// simple websocket client for testing the server

const ws = new WebSocket("ws://localhost:3000/ws");

ws.onopen = () => {
  console.log("connected to server");

  // test: create a room
  console.log("\n--- testing room creation ---");
  ws.send(
    JSON.stringify({
      type: "create_room",
    })
  );
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("received:", data);

  // after room is created, test search
  if (data.type === "room_created") {
    console.log("\n--- testing song search ---");
    ws.send(
      JSON.stringify({
        type: "search_songs",
        query: "never gonna give you up",
      })
    );
  }

  // after search results, close
  if (data.type === "search_results") {
    console.log(`\nfound ${data.results.length} results`);
    console.log("\n--- tests complete ---");
    ws.close();
    process.exit(0);
  }

  if (data.type === "error") {
    console.error("error:", data.message);
    ws.close();
    process.exit(1);
  }
};

ws.onerror = (error) => {
  console.error("websocket error:", error);
  process.exit(1);
};

ws.onclose = () => {
  console.log("connection closed");
};
