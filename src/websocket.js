const WebSocket = require('ws');
const http = require('http');

// Create an HTTP server
const server = http.createServer();

// Set up WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Heartbeat mechanism
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error: ${error}`);
  });

  // Send a message to the client
  ws.send(JSON.stringify('Welcome to the WebSocket server!'));
});

// Broadcast function to send data to all connected clients
function broadcast(data) {
  console.log('data is  broadcast started');
  wss.clients.forEach((client) => {
    console.log('client exist');
    if (client.readyState === WebSocket.OPEN) {
      console.log('data  broadcast in progress ');
      client.send(JSON.stringify(data));
      console.log('data  broadcast in completed ');
    }
  });
}

// Heartbeat mechanism to detect and close stale connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

module.exports = { server, broadcast };
