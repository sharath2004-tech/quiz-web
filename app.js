// Handles login, signup, and quiz logic
// Requires Firebase SDK loaded in HTML

document.addEventListener('DOMContentLoaded', function() {
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authError = document.getElementById('auth-error');
  const authSubmit = document.getElementById('auth-submit');
  const toggleAuthMode = document.getElementById('toggle-auth-mode');

  let isSignup = false;

  function setMode(signup) {
    isSignup = signup;
    authSubmit.textContent = signup ? 'Sign Up' : 'Login';
    toggleAuthMode.textContent = signup ? 'Back to Login' : 'Sign Up';
    authError.textContent = '';
  }

  if (toggleAuthMode) {
    toggleAuthMode.addEventListener('click', function() {
      setMode(!isSignup);
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = authEmail.value;
      const password = authPassword.value;
      authError.textContent = '';
      if (isSignup) {
        firebase.auth().createUserWithEmailAndPassword(email, password)
          .then(() => {
            authError.style.color = '#2ecc40';
            authError.textContent = 'Signup successful! You can now log in.';
            setTimeout(() => {
              setMode(false);
              authEmail.value = '';
              authPassword.value = '';
              authError.textContent = '';
            }, 1500);
          })
          .catch(err => {
            let msg = err.message;
            if (msg.includes('auth/email-already-in-use')) {
              msg = 'Email already in use.';
            } else if (msg.includes('auth/invalid-email')) {
              msg = 'Invalid email address.';
            } else if (msg.includes('auth/weak-password')) {
              msg = 'Password should be at least 6 characters.';
            }
            authError.style.color = '#e74c3c';
            authError.textContent = msg;
          });
      } else {
        firebase.auth().signInWithEmailAndPassword(email, password)
          .then(() => {
            window.location.href = 'quiz.html';
          })
          .catch(err => {
            let msg = err.message;
            if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('auth/wrong-password')) {
              msg = 'Invalid email or password. Please try again.';
            } else if (msg.includes('auth/user-not-found')) {
              msg = 'No account found for this email.';
            } else if (msg.includes('auth/too-many-requests')) {
              msg = 'Too many failed attempts. Please try again later.';
            }
            authError.style.color = '#e74c3c';
            authError.textContent = msg;
            authError.style.display = 'block';
          });
      }
    });
  }

  // Quiz page logic
  const quizBox = document.getElementById('quiz-box');
  const logoutBtn = document.getElementById('logout-btn');
  const quizOptionsForm = document.getElementById('quiz-options');

  let questions = [];
  let current = 0, score = 0;

  function decodeHTML(html) {
    var txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  function showResult() {
    const percent = Math.round((score / questions.length) * 100);
    let grade = '';
    let feedback = '';
    if (percent === 100) {
      grade = 'A+';
      feedback = 'Perfect! 🎉';
    } else if (percent >= 80) {
      grade = 'A';
      feedback = 'Great job!';
    } else if (percent >= 60) {
      grade = 'B';
      feedback = 'Good effort!';
    } else if (percent >= 40) {
      grade = 'C';
      feedback = 'Keep practicing!';
    } else {
      grade = 'D';
      feedback = 'Try again!';
    }
    quizBox.innerHTML = `
      <div id="result-box">
        <h2>You scored ${score}/${questions.length} 🎉</h2>
        <p>Percentage: ${percent}% &nbsp; Grade: <strong>${grade}</strong></p>
        <p>${feedback}</p>
        <button id="review-btn">Review Answers</button>
        <button id="restart-btn">Restart Quiz</button>
        <button id="home-btn">Go Home</button>
      </div>
    `;
    document.getElementById('review-btn').onclick = showReview;
    document.getElementById('restart-btn').onclick = () => {
      current = 0;
      score = 0;
      showQuestion();
    };
    document.getElementById('home-btn').onclick = () => {
      window.location.href = 'index.html';
    };
  }

  function showReview() {
    let html = '<h2>Review Answers</h2>';
    questions.forEach((q, idx) => {
      html += `<div class="review-item">
        <p><strong>Q${idx+1}:</strong> ${decodeHTML(q.question)}</p>`;
      q.answers.forEach((ans, i) => {
        let style = '';
        if (i === q.correct) style = 'color: #2ecc40; font-weight: bold;';
        if (current > idx && i === q.userAnswer && i !== q.correct) style = 'color: #e74c3c;';
        html += `<span style="${style}">${decodeHTML(ans)}</span><br>`;
      });
      html += '<hr></div>';
    });
    html += '<button id="restart-btn">Restart Quiz</button> <button id="home-btn">Go Home</button>';
    quizBox.innerHTML = html;
    document.getElementById('restart-btn').onclick = () => {
      current = 0;
      score = 0;
      showQuestion();
    };
    document.getElementById('home-btn').onclick = () => {
      window.location.href = 'index.html';
    };
  }

  // Images for each category
  const categoryImages = {
    '9': 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=400&q=80', // General Knowledge
    '17': 'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80', // Science & Nature
    '23': 'https://images.unsplash.com/photo-1503676382389-4809596d5290?auto=format&fit=crop&w=400&q=80', // History
    '21': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80', // Sports
    '22': 'https://images.unsplash.com/photo-1510936111840-6c7d9c5c1b43?auto=format&fit=crop&w=400&q=80', // Geography
    'any': 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=400&q=80', // Default
  };
  let selectedCategory = 'any';

  function showQuestion() {
    if (current >= questions.length) {
      showResult();
      return;
    }
    const q = questions[current];
    let selected = typeof q.userAnswer === 'number' ? q.userAnswer : null;
    let timer = 15; // seconds per question
    let timerInterval;

  // Pick image for this question based on category
  const imgUrl = categoryImages[selectedCategory] || categoryImages['any'];

    function render() {
      let mediaHtml = '';
      if (q.media) {
        if (q.media.type === 'image') {
          mediaHtml = `<img src="${q.media.url}" alt="Question Media" class="question-img" />`;
        } else if (q.media.type === 'audio') {
          mediaHtml = `<audio controls style="width:100%;margin-bottom:1rem;"><source src="${q.media.url}" type="audio/mpeg">Your browser does not support the audio element.</audio>`;
        } else if (q.media.type === 'video') {
          mediaHtml = `<video controls style="width:100%;max-width:260px;border-radius:1rem;margin-bottom:1rem;"><source src="${q.media.url}" type="video/mp4">Your browser does not support the video tag.</video>`;
        }
      } else {
        mediaHtml = `<img src="${imgUrl}" alt="Quiz" class="question-img" />`;
      }
      quizBox.innerHTML = `
        ${mediaHtml}
        <h2>${decodeHTML(q.question)}</h2>
        <div id="timer" style="margin-bottom:0.7rem;color:#a777e3;font-weight:600;">Time left: ${timer}s</div>
        <div id="answers">
          ${q.answers.map((ans, i) => `<button class="answer-btn${selected===i?' selected':''}" data-idx="${i}">${decodeHTML(ans)}</button>`).join('')}
        </div>
        <button id="next-btn" style="margin-top:1rem;">Next</button>
      `;
      document.querySelectorAll('.answer-btn').forEach(btn => {
        btn.onclick = function() {
          selected = parseInt(btn.dataset.idx);
          render();
        };
      });
      document.getElementById('next-btn').onclick = submitAnswer;
    }

    function submitAnswer() {
      clearInterval(timerInterval);
      q.userAnswer = selected;
      if (selected === q.correct) score++;
      current++;
      showQuestion();
    }

    timerInterval = setInterval(() => {
      timer--;
      if (timer <= 0) {
        submitAnswer();
      } else {
        const timerDiv = document.getElementById('timer');
        if (timerDiv) timerDiv.textContent = `Time left: ${timer}s`;
      }
    }, 1000);

    render();
  }

  async function fetchQuestions(category, difficulty, num) {
    // Sample multimedia questions for each category
    const multimediaQuestions = {
      '9': [{
        question: 'Which animal is shown in this image?',
        answers: ['Cat', 'Dog', 'Rabbit', 'Horse'],
        correct: 1,
        media: { type: 'image', url: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=400&q=80' }
      }],
      '17': [{
        question: 'What is shown in this science image?',
        answers: ['Atom', 'Cell', 'Galaxy', 'Molecule'],
        correct: 1,
        media: { type: 'image', url: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80' }
      }],
      '23': [{
        question: 'Listen to this historical speech. Who is the speaker?',
        answers: ['Martin Luther King Jr.', 'John F. Kennedy', 'Winston Churchill', 'Nelson Mandela'],
        correct: 0,
  media: { type: 'audio', url: 'https://ia800701.us.archive.org/13/items/MLKDream/MLKDream.mp3' }
      }],
      '21': [{
        question: 'Which sport is shown in this video?',
        answers: ['Basketball', 'Soccer', 'Tennis', 'Swimming'],
        correct: 1,
        media: { type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4' }
      }],
      '22': [{
        question: 'Which landmark is shown in this image?',
        answers: ['Eiffel Tower', 'Statue of Liberty', 'Colosseum', 'Great Wall'],
        correct: 0,
        media: { type: 'image', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80' }
      }],
      'any': [{
        question: 'Which animal is shown in this image?',
        answers: ['Cat', 'Dog', 'Rabbit', 'Horse'],
        correct: 1,
        media: { type: 'image', url: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=400&q=80' }
      }]
    };
    if (multimediaQuestions[category]) {
      // Fill up to num questions with API questions if needed
      let extraQuestions = [];
      if (num > multimediaQuestions[category].length) {
        let url = `https://opentdb.com/api.php?amount=${num - multimediaQuestions[category].length}`;
        if (category !== 'any') url += `&category=${category}`;
        if (difficulty !== 'any') url += `&difficulty=${difficulty}`;
        url += '&type=multiple';
        const res = await fetch(url);
        const data = await res.json();
        extraQuestions = data.results.map(q => {
          const answers = [...q.incorrect_answers];
          const correctIdx = Math.floor(Math.random() * (answers.length + 1));
          answers.splice(correctIdx, 0, q.correct_answer);
          return {
            question: q.question,
            answers: answers,
            correct: correctIdx
          };
        });
      }
      return [...multimediaQuestions[category], ...extraQuestions];
    }
    let url = `https://opentdb.com/api.php?amount=${num}`;
    if (category !== 'any') url += `&category=${category}`;
    if (difficulty !== 'any') url += `&difficulty=${difficulty}`;
    url += '&type=multiple';
    const res = await fetch(url);
    const data = await res.json();
    // Format questions
    return data.results.map(q => {
      const answers = [...q.incorrect_answers];
      const correctIdx = Math.floor(Math.random() * (answers.length + 1));
      answers.splice(correctIdx, 0, q.correct_answer);
      return {
        question: q.question,
        answers: answers,
        correct: correctIdx
      };
    });
  }

  if (quizOptionsForm && quizBox) {
    quizOptionsForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      selectedCategory = document.getElementById('category').value;
      const difficulty = document.getElementById('difficulty').value;
      const num = document.getElementById('num-questions').value;
      quizBox.innerHTML = '<p>Loading questions...</p>';
      questions = await fetchQuestions(selectedCategory, difficulty, num);
      current = 0;
      score = 0;
      showQuestion();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      firebase.auth().signOut().then(() => {
        window.location.href = 'index.html';
      });
    });
  }
});
