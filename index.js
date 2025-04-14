const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch');

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

io.on('connection', (socket) => {
  const playerId = socket.id;
  players.push(playerId);
  scores[playerId] = 0;

  io.emit('players', players);
  io.emit('scores', scores);

  socket.on('getQuestion', async () => {
    const q = await getQuestionFromAPI();
    if (q) io.emit('newQuestion', q);
  });

  socket.on('submitAnswer', ({ answer }) => {
    io.emit('answerSubmitted', { player: playerId, answer });

    // score logic is simplistic — only correct answer gets points
    if (lastQuestion && answer === lastQuestion.answer) {
      scores[playerId] += 10;
    }

    io.emit('scores', scores);
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p !== playerId);
    delete scores[playerId];
    io.emit('players', players);
    io.emit('scores', scores);
  });
});

let lastQuestion = null;

async function getQuestionFromAPI() {
  const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
  const data = await res.json();

  if (!data.results || !data.results.length) return null;

  const raw = data.results[0];
  const decodedQuestion = {
    question: decodeHTMLEntities(raw.question),
    options: shuffleArray([
      ...raw.incorrect_answers.map(decodeHTMLEntities),
      decodeHTMLEntities(raw.correct_answer)
    ]),
    answer: decodeHTMLEntities(raw.correct_answer)
  };

  lastQuestion = decodedQuestion;
  return decodedQuestion;
}

function decodeHTMLEntities(text) {
  return text.replace(/&quot;/g, '"')
             .replace(/&#039;/g, "'")
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>');
}

function shuffleArray(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
