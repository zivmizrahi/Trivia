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

let players = {}; // { socketId: { id, name } }
let scores = {};
let lastQuestion = null;
let submittedAnswers = {}; // { socketId: answer }

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
    const q = await getQuestionFromAPI();
    if (q) {
      submittedAnswers = {}; // reset for new round
      io.emit('newQuestion', q);
    }
  });

  socket.on('submitAnswer', ({ answer }) => {
    submittedAnswers[playerId] = answer;
    io.emit('answerSubmitted', { player: playerId, answer });

    if (lastQuestion && answer === lastQuestion.answer) {
      scores[playerId] += 10;
    }
    io.emit('scores', scores);

    if (Object.keys(submittedAnswers).length === Object.keys(players).length) {
      // All players answered
      io.emit('showCorrectAnswer');
      let timeLeft = 3;

      const countdownInterval = setInterval(async () => {
        io.emit('countdown', timeLeft);
        if (timeLeft === 0) {
          clearInterval(countdownInterval);
          const nextQuestion = await getQuestionFromAPI();
          if (nextQuestion) {
            submittedAnswers = {};
            io.emit('newQuestion', nextQuestion);
          }
        }
        timeLeft--;
      }, 1000);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Player disconnected: ${playerId}`);
    delete players[playerId];
    delete scores[playerId];
    delete submittedAnswers[playerId];
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
