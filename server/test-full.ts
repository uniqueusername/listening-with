// comprehensive server test suite

const SERVER_URL = "ws://localhost:2946/ws";

class TestRunner {
  private hostWs: WebSocket | null = null;
  private clientWs: WebSocket | null = null;
  private roomData: any = null;
  private testsPassed = 0;
  private testsFailed = 0;

  async run() {
    console.log("🧪 starting comprehensive server tests\n");

    try {
      await this.testHealthEndpoint();
      await this.testHostRoomCreation();
      await this.testClientJoin();
      await this.testSongSearch();
      await this.testSongSubmission();
      await this.testHeartbeat();
      await this.testMultipleClients();
      await this.testInvalidMessages();

      console.log("\n✅ all tests completed!");
      console.log(`passed: ${this.testsPassed}, failed: ${this.testsFailed}`);

      process.exit(this.testsFailed > 0 ? 1 : 0);
    } catch (error) {
      console.error("\n❌ test suite failed:", error);
      process.exit(1);
    }
  }

  private async testHealthEndpoint() {
    console.log("📋 test: health endpoint");

    try {
      const response = await fetch("http://localhost:2946/health");
      const text = await response.text();

      if (response.status === 200 && text === "ok") {
        this.pass("health endpoint returns ok");
      } else {
        this.fail("health endpoint check", `expected 200 "ok", got ${response.status} "${text}"`);
      }
    } catch (error) {
      this.fail("health endpoint check", error);
    }
  }

  private async testHostRoomCreation() {
    console.log("\n📋 test: host room creation");

    return new Promise<void>((resolve, reject) => {
      this.hostWs = new WebSocket(SERVER_URL);

      this.hostWs.onopen = () => {
        this.pass("host websocket connection");

        this.hostWs!.send(JSON.stringify({ type: "create_room" }));
      };

      this.hostWs.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "room_created") {
          this.roomData = data;

          if (data.code && data.code.length === 4) {
            this.pass("room code generated (4 chars)");
          } else {
            this.fail("room code validation", `invalid code: ${data.code}`);
          }

          if (data.qrCodeDataUrl && data.qrCodeDataUrl.startsWith("data:image/png;base64,")) {
            this.pass("qr code generated");
          } else {
            this.fail("qr code validation", "invalid qr data url");
          }

          resolve();
        } else if (data.type === "error") {
          this.fail("room creation", data.message);
          reject(new Error(data.message));
        }
      };

      this.hostWs.onerror = (error) => {
        this.fail("host websocket connection", error);
        reject(error);
      };

      setTimeout(() => reject(new Error("timeout")), 5000);
    });
  }

  private async testClientJoin() {
    console.log("\n📋 test: client join");

    return new Promise<void>((resolve, reject) => {
      this.clientWs = new WebSocket(SERVER_URL);

      let hostReceivedJoin = false;
      let clientReceivedConfirm = false;

      const checkComplete = () => {
        if (hostReceivedJoin && clientReceivedConfirm) {
          this.pass("client join flow complete");
          resolve();
        }
      };

      this.hostWs!.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "client_joined") {
          this.pass("host received client_joined notification");

          if (data.displayName === "test user") {
            this.pass("display name transmitted correctly");
          }

          if (data.clientCount === 1) {
            this.pass("client count correct");
          }

          hostReceivedJoin = true;
          checkComplete();
        }
      };

      this.clientWs.onopen = () => {
        this.pass("client websocket connection");

        this.clientWs!.send(
          JSON.stringify({
            type: "join_room",
            roomCode: this.roomData.code,
            displayName: "test user",
          })
        );
      };

      this.clientWs.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "room_joined") {
          this.pass("client received room_joined confirmation");

          if (data.roomCode === this.roomData.code) {
            this.pass("room code matches");
          }

          clientReceivedConfirm = true;
          checkComplete();
        } else if (data.type === "error") {
          this.fail("client join", data.message);
          reject(new Error(data.message));
        }
      };

      this.clientWs.onerror = (error) => {
        this.fail("client websocket connection", error);
        reject(error);
      };

      setTimeout(() => reject(new Error("timeout")), 5000);
    });
  }

  private async testSongSearch() {
    console.log("\n📋 test: song search");

    return new Promise<void>((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (data.type === "search_results") {
          if (Array.isArray(data.results)) {
            this.pass("search results returned as array");

            if (data.results.length > 0) {
              this.pass(`found ${data.results.length} results`);

              const first = data.results[0];
              if (first.videoId && first.title && first.artist) {
                this.pass("search results have required fields");
              } else {
                this.fail("search result validation", "missing required fields");
              }
            } else {
              this.fail("search results", "no results returned");
            }
          }

          this.clientWs!.removeEventListener("message", messageHandler);
          resolve();
        } else if (data.type === "error") {
          this.fail("song search", data.message);
          reject(new Error(data.message));
        }
      };

      this.clientWs!.addEventListener("message", messageHandler);

      this.clientWs!.send(
        JSON.stringify({
          type: "search_songs",
          query: "test song",
        })
      );

      setTimeout(() => reject(new Error("timeout")), 10000);
    });
  }

  private async testSongSubmission() {
    console.log("\n📋 test: song submission");

    return new Promise<void>((resolve, reject) => {
      let clientReceivedSuccess = false;
      let hostReceivedSong = false;

      const checkComplete = () => {
        if (clientReceivedSuccess && hostReceivedSong) {
          this.pass("song submission flow complete");
          resolve();
        }
      };

      const clientHandler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (data.type === "song_added_success") {
          this.pass("client received success confirmation");
          clientReceivedSuccess = true;
          checkComplete();
        }
      };

      const hostHandler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (data.type === "song_added") {
          this.pass("host received song_added notification");

          if (data.song && data.song.videoId === "test123") {
            this.pass("song data transmitted correctly");
          }

          if (data.song.submittedBy === "test user") {
            this.pass("submitter name included");
          }

          if (data.queueLength === 1) {
            this.pass("queue length correct");
          }

          hostReceivedSong = true;
          checkComplete();
        }
      };

      this.clientWs!.addEventListener("message", clientHandler);
      this.hostWs!.addEventListener("message", hostHandler);

      this.clientWs!.send(
        JSON.stringify({
          type: "add_song",
          videoId: "test123",
          title: "test song",
          artist: "test artist",
          submittedBy: "test user",
        })
      );

      setTimeout(() => {
        this.clientWs!.removeEventListener("message", clientHandler);
        this.hostWs!.removeEventListener("message", hostHandler);
        reject(new Error("timeout"));
      }, 5000);
    });
  }

  private async testHeartbeat() {
    console.log("\n📋 test: heartbeat");

    return new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (data.type === "heartbeat_ack") {
          this.pass("heartbeat acknowledged");
          this.clientWs!.removeEventListener("message", handler);
          resolve();
        }
      };

      this.clientWs!.addEventListener("message", handler);

      this.clientWs!.send(JSON.stringify({ type: "heartbeat" }));

      setTimeout(() => {
        this.clientWs!.removeEventListener("message", handler);
        reject(new Error("timeout"));
      }, 5000);
    });
  }

  private async testMultipleClients() {
    console.log("\n📋 test: multiple clients");

    const client1 = new WebSocket(SERVER_URL);
    const client2 = new WebSocket(SERVER_URL);

    return new Promise<void>((resolve, reject) => {
      let client1Joined = false;
      let client2Joined = false;

      const checkComplete = () => {
        if (client1Joined && client2Joined) {
          this.pass("multiple clients can join same room");
          client1.close();
          client2.close();
          resolve();
        }
      };

      client1.onopen = () => {
        client1.send(
          JSON.stringify({
            type: "join_room",
            roomCode: this.roomData.code,
            displayName: "client 1",
          })
        );
      };

      client1.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "room_joined") {
          client1Joined = true;
          checkComplete();
        }
      };

      client2.onopen = () => {
        client2.send(
          JSON.stringify({
            type: "join_room",
            roomCode: this.roomData.code,
            displayName: "client 2",
          })
        );
      };

      client2.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "room_joined") {
          client2Joined = true;
          checkComplete();
        }
      };

      setTimeout(() => reject(new Error("timeout")), 5000);
    });
  }

  private async testInvalidMessages() {
    console.log("\n📋 test: invalid message handling");

    return new Promise<void>((resolve, reject) => {
      const testClient = new WebSocket(SERVER_URL);

      let errorsReceived = 0;
      const expectedErrors = 3;

      const handler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (data.type === "error") {
          errorsReceived++;

          if (errorsReceived === expectedErrors) {
            this.pass("server handles invalid messages correctly");
            testClient.close();
            resolve();
          }
        }
      };

      testClient.onopen = () => {
        testClient.addEventListener("message", handler);

        // test 1: unknown message type
        testClient.send(JSON.stringify({ type: "invalid_type" }));

        // test 2: missing required fields
        setTimeout(() => {
          testClient.send(JSON.stringify({ type: "search_songs" }));
        }, 100);

        // test 3: join without auth
        setTimeout(() => {
          testClient.send(
            JSON.stringify({ type: "join_room", roomCode: "TEST" })
          );
        }, 200);
      };

      setTimeout(() => {
        if (errorsReceived === 0) {
          this.fail("invalid message handling", "no errors received");
        }
        reject(new Error("timeout"));
      }, 5000);
    });
  }

  private pass(test: string) {
    console.log(`  ✅ ${test}`);
    this.testsPassed++;
  }

  private fail(test: string, reason: any) {
    console.log(`  ❌ ${test}: ${reason}`);
    this.testsFailed++;
  }
}

const runner = new TestRunner();
runner.run();
