import { workoutPlan, dietData, trainingRules } from './data.js';

// --- State ---
let state = {
  currentView: 'home',
  currentWorkoutDay: null,
  waterConsumed: 0,
  macros: { protein: false, fat: false, carbs: false },
  supplements: {},
  completedExercises: {}, 
  finishedDays: {}, 
  lastUpdate: null
};

const STORAGE_KEY = 'chad_natural_state';

// --- Utils ---
function getBrasiliaDate() {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function formatDate(date) {
  const days = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
  const months = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  return {
    dayName: days[date.getDay()],
    dayShort: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][date.getDay()],
    fullDate: `${date.getDate()} DE ${months[date.getMonth()]}`
  };
}

function getTodayKey() {
  const d = getBrasiliaDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- Core ---
function init() {
  loadState();
  updateDateDisplay();
  renderHome();
  renderWeeklyPlan();
  updateProgressBars();
  
  window.switchView = switchView;
  window.addWater = addWater;
  window.resetWater = resetWater;
  window.toggleMacro = toggleMacro;
  window.toggleSupplement = toggleSupplement;
  window.toggleExercise = toggleExercise;
  window.finishWorkout = finishWorkout;
  window.closeSuccess = closeSuccess;
  window.undoFinish = undoFinish;
  window.toggleDayFinished = toggleDayFinished;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const today = getTodayKey();
  
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.lastUpdate === today) {
      state = { ...state, ...parsed };
    } else {
      // New day, reset daily stats
      state.lastUpdate = today;
      state.waterConsumed = 0;
      state.macros = { protein: false, fat: false, carbs: false };
      state.supplements = {};
      state.completedExercises = {};
      state.finishedDays = {};
      saveState();
    }
  } else {
    state.lastUpdate = today;
    saveState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateProgressBars();
}

// --- UI Actions ---
function switchView(viewId, day = null) {
  document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById(`view-${viewId}`).classList.add('active');
  const navItem = document.getElementById(`nav-${viewId}`);
  if (navItem) navItem.classList.add('active');
  
  state.currentView = viewId;
  
  if (viewId === 'workout') {
    state.currentWorkoutDay = day || formatDate(getBrasiliaDate()).dayShort;
    renderWorkout();
  }
  if (viewId === 'home') renderHome();
  if (viewId === 'plan') renderWeeklyPlan();
}

function updateDateDisplay() {
  const dateInfo = formatDate(getBrasiliaDate());
  document.getElementById('current-day').innerText = dateInfo.dayName;
  document.getElementById('current-date').innerText = dateInfo.fullDate;
}

function renderHome() {
  const dateInfo = formatDate(getBrasiliaDate());
  const todayWorkout = workoutPlan[dateInfo.dayShort];
  document.getElementById('today-workout-name').innerText = todayWorkout ? todayWorkout.name : "Descanso";
  if (todayWorkout) document.documentElement.style.setProperty('--accent-primary', todayWorkout.color);

  const suppsList = document.getElementById('home-supps-list');
  suppsList.innerHTML = dietData.supplements.map(s => `
    <div class="exercise-item">
      <div class="exercise-info">
        <div class="exercise-name">${s.name}</div>
        <div class="exercise-meta">${s.dose}</div>
      </div>
      <div class="checkbox-container ${state.supplements[s.id] ? 'checked' : ''}" onclick="toggleSupplement('${s.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    </div>
  `).join('');
}

function renderWorkout() {
  const dateInfo = formatDate(getBrasiliaDate());
  const displayDay = state.currentWorkoutDay || dateInfo.dayShort;
  const workout = workoutPlan[displayDay];
  const list = document.getElementById('exercise-list');
  
  if (!workout) {
    list.innerHTML = `<p class='text-secondary'>Descanso.</p>`;
    return;
  }

  document.getElementById('workout-view-title').innerText = workout.name;
  document.getElementById('workout-view-subtitle').innerText = `Plano: ${displayDay}`;
  
  const finishBtnContainer = document.getElementById('workout-complete-btn-container');
  if (!workout || workout.exercises.length === 0) {
    finishBtnContainer.style.display = 'none';
  } else {
    finishBtnContainer.style.display = 'block';
  }

  const finishBtn = document.getElementById('finish-workout-btn');
  // Clear previous listener to avoid duplicates
  const newBtn = finishBtn.cloneNode(true);
  finishBtn.parentNode.replaceChild(newBtn, finishBtn);
  
  if (state.finishedDays[displayDay]) {
    newBtn.innerHTML = `TREINO CONCLUÍDO ✅ <span style="font-size: 0.7rem; display: block; opacity: 0.6;">(Clique para desfazer)</span>`;
    newBtn.style.background = "#10b981";
    newBtn.style.opacity = "1";
    newBtn.onclick = () => {
      console.log("Desfazendo treino de:", displayDay);
      undoFinish(displayDay);
    };
  } else {
    newBtn.innerHTML = "FINALIZAR TREINO 🔥";
    newBtn.style.background = "var(--accent-primary)";
    newBtn.onclick = () => {
      console.log("Finalizando treino de:", displayDay);
      finishWorkout();
    };
  }

  list.innerHTML = workout.exercises.map(ex => {
    const key = `${displayDay}-${ex.name}`;
    const isDone = state.completedExercises[key];
    return `
      <div class="exercise-item">
        <div class="exercise-info"><div class="exercise-name">${ex.name}</div><div class="exercise-meta">${ex.sets}x${ex.reps}</div></div>
        <div class="checkbox-container ${isDone ? 'checked' : ''}" onclick="toggleExercise('${ex.name}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
      </div>
    `;
  }).join('');
}

function renderWeeklyPlan() {
  const list = document.getElementById('weekly-plan-list');
  const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  list.innerHTML = days.map(day => {
    const p = workoutPlan[day];
    const isFinished = state.finishedDays[day];
    return `
      <div class="glass-card" onclick="switchView('workout', '${day}')" style="border-left: 4px solid ${p.color}; cursor: pointer; transition: all 0.2s ease;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: ${p.color}; font-weight: 800; font-size: 0.75rem;">${day.toUpperCase()}</span>
          <div onclick="event.stopPropagation(); toggleDayFinished('${day}')">
            ${isFinished ? `<span style="background: #10b981; color: white; font-size: 0.6rem; padding: 4px 10px; border-radius: 10px; font-weight: 800; display: flex; align-items: center; gap: 4px;">CONCLUÍDO ✅</span>` : `<span class="text-secondary" style="font-size: 0.7rem; border: 1px solid var(--glass-border); padding: 4px 10px; border-radius: 10px;">${p.exercises.length} EXS</span>`}
          </div>
        </div>
        <div style="font-weight: 700; font-size: 1.1rem; margin-top: 4px;">${p.name}</div>
      </div>
    `;
  }).join('');
}

function addWater(amount) {
  state.waterConsumed = Math.min(state.waterConsumed + amount, 10);
  saveState();
}

function resetWater() {
  state.waterConsumed = 0;
  saveState();
}

function updateWaterUI() {
  const target = dietData?.water?.target || 4;
  const percent = Math.min((state.waterConsumed / target) * 100, 100);
  const elAmount = document.getElementById('water-amount');
  if (elAmount) elAmount.innerHTML = `${state.waterConsumed.toFixed(1)}L <span style="font-size: 1rem; color: var(--text-secondary);">/ ${target}L</span>`;
  if (document.getElementById('water-fill-main')) document.getElementById('water-fill-main').style.width = `${percent}%`;
  if (document.getElementById('water-fill-home')) document.getElementById('water-fill-home').style.width = `${percent}%`;
  if (document.getElementById('water-percent')) document.getElementById('water-percent').innerText = `${Math.round(percent)}%`;
}

function toggleMacro(type) {
  state.macros[type] = !state.macros[type];
  saveState();
}

function toggleSupplement(id) {
  state.supplements[id] = !state.supplements[id];
  saveState();
  renderHome();
}

function toggleExercise(name) {
  const displayDay = state.currentWorkoutDay || formatDate(getBrasiliaDate()).dayShort;
  const key = `${displayDay}-${name}`;
  state.completedExercises[key] = !state.completedExercises[key];
  saveState();
  renderWorkout();
}

function undoFinish(day) {
  state.finishedDays[day] = false;
  saveState();
  renderWorkout();
  if (state.currentView === 'plan') renderWeeklyPlan();
}

function toggleDayFinished(day) {
  state.finishedDays[day] = !state.finishedDays[day];
  saveState();
  if (state.currentView === 'plan') renderWeeklyPlan();
  if (state.currentView === 'workout') renderWorkout();
}

function updateProgressBars() {
  const totalMacros = 3;
  const doneMacros = Object.values(state.macros).filter(v => v).length;
  const macroPercent = Math.round((doneMacros / totalMacros) * 100);
  if (document.getElementById('macro-percent')) document.getElementById('macro-percent').innerText = `${macroPercent}%`;
  if (document.getElementById('macro-fill-home')) document.getElementById('macro-fill-home').style.width = `${macroPercent}%`;
  updateWaterUI();
  
  const checkP = document.getElementById('check-protein');
  const checkF = document.getElementById('check-fat');
  const checkC = document.getElementById('check-carbs');
  if (checkP) checkP.classList.toggle('checked', state.macros.protein);
  if (checkF) checkF.classList.toggle('checked', state.macros.fat);
  if (checkC) checkC.classList.toggle('checked', state.macros.carbs);
}

function finishWorkout() {
  const displayDay = state.currentWorkoutDay || formatDate(getBrasiliaDate()).dayShort;
  state.finishedDays[displayDay] = true;
  saveState();
  renderWorkout();
  document.getElementById('success-overlay').style.display = 'flex';
}

function closeSuccess() {
  document.getElementById('success-overlay').style.display = 'none';
  switchView('plan');
}

// Start
init();
