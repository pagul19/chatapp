const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('ioredis');
const redisHost = process.env.REDIS_HOST;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const redisClient = new Redis({
  host: redisHost,
  port: 6379,
}); // Verbindung zu Redis herstellen

app.use(express.static(__dirname + '/public'));

io.on('connection', (socket) => {
  console.log('Ein Benutzer hat sich verbunden');

  // Funktion zum Aktualisieren der Benutzerliste und Senden an alle Clients
  const updateUserList = async () => {
    const usernames = await redisClient.smembers('usernames');
    io.emit('userList', usernames);

    // Hole die Chat-Historie aus Redis und sende sie an den Client
    const chatHistory = await redisClient.lrange('chatHistory', 0, -1);
    io.emit('chatHistory', chatHistory.map(JSON.parse));
  };

  // Initialisiere die Benutzerliste für den verbundenen Client
  updateUserList();

  socket.on('setUsername', async (username) => {
    // Prüfe, ob der Benutzername bereits verwendet wird
    const isMember = await redisClient.sismember('usernames', username);

    if (isMember) {
      socket.emit('usernameExists', true);
    } else {
      // Lösche den alten Benutzernamen aus der Redis-Liste (falls vorhanden)
      if (socket.username) {
        await redisClient.srem('usernames', socket.username);
      }

      // Speichere den neuen Benutzernamen in der Redis-Liste
      await redisClient.sadd('usernames', username);
      socket.username = username;

      // Benachrichtige alle Benutzer über den neuen Benutzernamen
      io.emit('userJoined', username);

      // Aktualisiere die Benutzerliste für alle Clients
      updateUserList();
    }
  });

  socket.on('chatMessage', async (message) => {
    const chatMessage = {
      username: socket.username,
      message: message,
    };

    // Speichere die Chat-Nachricht im Redis-Chatverlauf
    await redisClient.lpush('chatHistory', JSON.stringify(chatMessage));
    redisClient.ltrim('chatHistory', 0, 99); // Begrenze die Anzahl der gespeicherten Nachrichten

    io.emit('chatMessage', chatMessage);
  });

  socket.on('disconnect', async () => {
    if (socket.username) {
      await redisClient.srem('usernames', socket.username);
      io.emit('userLeft', socket.username);
      console.log(`${socket.username} hat den Chat verlassen`);

      // Aktualisiere die Benutzerliste für alle Clients
      updateUserList();
    }
  });

  socket.on('changeUsername', async (newUsername) => {
    // Lösche den alten Benutzernamen aus der Redis-Liste
    await redisClient.srem('usernames', socket.username);

    // Aktualisiere den Benutzernamen des Sockets und speichere den neuen Benutzernamen
    socket.username = newUsername;
    await redisClient.sadd('usernames', newUsername);

    // Benachrichtige alle Benutzer über den aktualisierten Benutzernamen
    io.emit('usernameChanged', {
      oldUsername: socket.username,
      newUsername: newUsername,
    });

    // Aktualisiere die Benutzerliste für alle Clients
    updateUserList();
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Der Server läuft auf Port ${port}`);
});
