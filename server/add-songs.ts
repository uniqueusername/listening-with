#!/usr/bin/env bun

// Usage: bun add-songs.ts <roomCode> [host] <title> <artist> <videoId> [<title> <artist> <videoId> ...]
// Example: bun add-songs.ts fnkq lw.hyperbeam.sh "Never Gonna Give You Up" "Rick Astley" "dQw4w9WgXcQ"

const roomCode = process.argv[2];
const host = process.argv[3] || "lw.hyperbeam.sh";

if (!roomCode) {
  console.error("Usage: bun add-songs.ts <roomCode> [host] <title> <artist> <videoId> [<title> <artist> <videoId> ...]");
  console.error("Example: bun add-songs.ts fnkq lw.hyperbeam.sh \"Never Gonna Give You Up\" \"Rick Astley\" \"dQw4w9WgXcQ\"");
  process.exit(1);
}

// Parse songs from command line arguments (groups of 3: title, artist, videoId)
const songArgs = process.argv.slice(4);

if (songArgs.length === 0) {
  console.error("Error: No songs provided");
  console.error("Usage: bun add-songs.ts <roomCode> [host] <title> <artist> <videoId> [<title> <artist> <videoId> ...]");
  process.exit(1);
}

if (songArgs.length % 3 !== 0) {
  console.error("Error: Song arguments must be in groups of 3 (title, artist, videoId)");
  process.exit(1);
}

const songs = [];
for (let i = 0; i < songArgs.length; i += 3) {
  songs.push({
    title: songArgs[i],
    artist: songArgs[i + 1],
    videoId: songArgs[i + 2],
  });
}

const displayName = "Agent";

const ws = new WebSocket(`wss://${host}/ws`);

ws.onopen = () => {
  console.log(`Connected to ${host}, joining room ${roomCode}...`);
  ws.send(JSON.stringify({
    type: "join_room",
    roomCode,
    displayName,
  }));
};

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data as string);

  if (data.type === "room_joined") {
    console.log("Joined room! Adding songs...");
    for (const song of songs) {
      console.log(`Adding: ${song.title} - ${song.artist}`);
      ws.send(JSON.stringify({
        type: "add_song",
        ...song,
        submittedBy: displayName,
      }));
      await new Promise((r) => setTimeout(r, 500));
    }
    setTimeout(() => {
      console.log("Done!");
      ws.close();
      process.exit(0);
    }, 1000);
  }

  if (data.type === "song_added_success") {
    console.log("  ✓ Song added successfully");
  }

  if (data.type === "error") {
    console.error("Error:", data.message);
    ws.close();
    process.exit(1);
  }
};

ws.onerror = (err) => {
  console.error("WebSocket error:", err);
  process.exit(1);
};

setTimeout(() => {
  console.error("Timeout - closing");
  process.exit(1);
}, 30000);
