// js/app.js (ES module)
import { initXO, handleXOSession, cleanupXO } from './xo.js';
import { initLetters, handleLettersSession, cleanupLetters } from './letters.js';
import { initBoard, handleBoardSession, cleanupBoard } from './board.js';

/* === config === */
const firebaseConfig = {
  apiKey: "AIzaSyC2eUDscOP_Vgq7iFGRQm09soisquGHe9g",
  authDomain: "taka-e3b3d.firebaseapp.com",
  databaseURL: "https://taka-e3b3d-default-rtdb.firebaseio.com",
  projectId: "taka-e3b3d",
  storageBucket: "taka-e3b3d.firebasestorage.app",
  messagingSenderId: "719794585832",
  appId: "1:719794585832:web:1c235cfd14e78b5a92095d",
  measurementId: "G-6MC3MZZYTZ"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/* DOM refs */
const landing = document.getElementById('landing');
const gamesPage = document.getElementById('gamesPage');
const nickInput = document.getElementById('nickInput');
const userCodeInput = document.getElementById('userCodeInput');
const loginBtn = document.getElementById('loginBtn');
const clearLocal = document.getElementById('clearLocal');
const meBox = document.getElementById('meBox');
const roomInput = document.getElementById('roomInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const playersList = document.getElementById('playersList');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const requestsBox = document.getElementById('requestsBox');
const sessionsBox = document.getElementById('sessionsBox');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const logoutBtn = document.getElementById('logoutBtn');
const reqBoard = document.getElementById('reqBoard');
const reqXO = document.getElementById('reqXO');
const reqLetters = document.getElementById('reqLetters');

/* local state */
let me = { id: null, nick: '', code: '' };
let roomId = null; let roomRef = null;

/* helpers */
const makeId = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,6);