const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const PORT = process.env.PORT || 3001;

let players = [];
let scores = {};

const questions = [
  {
    question: "What is the capital of Italy?",
    options: ["Rome", "Paris", "Madrid", "Berlin"],
    answer: "Rome"
  },
  {
    question: "What gas do plants absorb from the atmosphere?",
    options: ["Oxygen", "Hydrogen", "Carbon Dioxide", "Nitrogen"],
    answer: "Carbon Dioxide"
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Da Vinci", "Van Gogh", "Michelangelo", "Picasso"],
    answer: "Da Vinci"
  }
];

function getRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)];
}

io.on('connection', (socket) => {
  const playerId = socket.id;
  players.push(playerId);
  scores[playerId] = 0;

  io.emit('players', players);
  io.emit('scores', scores);

  socket.on('getQuestion', () => {
    io.emit('newQuestion', getRandomQuestion());
  });

  socket.on('submitAnswer', ({ answer }) => {
    const correct = questions.find(q => q.options.includes(answer) && q.answer === answer);
    if (correct) {
      scores[playerId] += 10;
    }
    io.emit('answerSubmitted', { player: playerId, answer });
    io.emit('scores', scores);
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p !== playerId);
    delete scores[playerId];
    io.emit('players', players);
    io.emit('scores', scores);
  });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
