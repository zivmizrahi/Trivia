const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3001;

let players = {}; // { socketId: { id, name } }
let scores = {};
let lastQuestion = null;

io.on('connection', (socket) => {
  const playerId = socket.id;
  console.log(`🟢 New connection: ${playerId}`);

  socket.on('join', (name) => {
    console.log(`👤 Player joined: ${name} (${playerId})`);
    players[playerId] = { id: playerId, name: name || 'Anonymous' };
    scores[playerId] = 0;
    io.emit('players', Object.values(players));
    io.emit('scores', scores);
  });

  socket.on('getQuestion', async () => {
    console.log(`📡 ${playerId} requested a question`);
    const q = await getQuestionFromAPI();
    if (q) {
      console.log(`✅ Sending new question to all players`);
      io.emit('newQuestion', q);
    } else {
      console.error(`❌ Failed to fetch question`);
    }
  });

  socket.on('submitAnswer', ({ answer }) => {
    console.log(`📨 Answer received from ${playerId}: ${answer}`);
    io.emit('answerSubmitted', { player: playerId, answer });

    if (lastQuestion && answer === lastQuestion.answer) {
      scores[playerId] += 10;
    }

    io.emit('scores', scores);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Player disconnected: ${playerId}`);
    delete players[playerId];
    delete scores[playerId];
    io.emit('players', Object.values(players));
    io.emit('scores', scores);
  });
});

async function getQuestionFromAPI() {
  try {
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
  } catch (err) {
    console.error("❌ Error fetching trivia question:", err);
    return null;
  }
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

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
