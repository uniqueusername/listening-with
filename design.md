## description
*listening-with* is an application that enables functionality similar to spotify's "jams" for youtube music users.

## design
*listening-with* is a two-part hybrid mobile and web application. 

### design
#### server
the *listening-with* server will be a bun-powered express server exposed to the internet that coordinates connection between host and clients. a host app will send an http request to the server, and the server will open a "room" with a unique id. rooms can accommodate one host and several clients. clients will send an http request to the server containing the room id to join the room. clients in a room will send songs to the server via http requests, and the server will forward those songs to the host's queue.

#### host app
a "host" user's phone will have youtube music installed alongside the *listening-with* host application. the host app will be aware of the status of the currently playing song, and hold its own queue, independent from the youtube music app's queue. for the queue to function, *listening-with* (both host and client) must integrate with some available api that contains the repository of songs available for play on youtube music. when the host app observes that the currently playing song on youtube music has ended, it pulls the oldest song from the *listening-with* queue (first-in-first-out) and plays that song on youtube music, ignoring the youtube music queue and using the *listening-with* queue as an authoritative queue.

##### alternative queue design
an alternative to using the *listening-with* queue as authoritative would be to avoid maintaining two queues altogether, and instead add songs sent by clients to the room directly to the host's youtube music queue. this way, the host user can do all queue management from within the youtube music app itself, and we don't have to reimplement queue management functionality within *listening-with*. whether this is a viable alternative depends on what level of interactibility the *listening-with* app will have with the host's youtube music app.

#### client app
the "clients" will not have any music playing on their own devices, but they will be able to join their host's room on the server via a web frontend that can be accessed through their browsers. once in the room, clients can use the web ui to search for a song and "add to queue". this will add the song to the room queue, where it will be played on the host's device once the current song finishes.