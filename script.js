import L from 'leaflet';

class Workout {
  date = new Date();
  id = String(Date.now()).slice(-10);
  type = '';
  description = '';

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // min
  }

  _setDescription() {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  pace = 0;
  cadence = 0;

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this._calcPace();
    this._setDescription();
  }

  _calcPace() {
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  speed = 0;
  elevationGain = 0;

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this._calcSpeed();
    this._setDescription();
  }

  _calcSpeed() {
    this.speed = (this.distance / this.duration) * 60;
  }
}

// Application Architecture
const form = document.querySelector('.form');
const workoutsContainer = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent = null;
  #workouts = [];

  constructor() {
    this._getPosition();
    this._loadLocalStorage();

    form.addEventListener('submit', this._handleNewWorkout);
    inputType.addEventListener('change', this._toggleElevationField);
    workoutsContainer.addEventListener('click', this._moveToPopup);
  }

  _getPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap,
        () => alert('Could not get your position')
      );
    }
  };

  _loadMap = (position) => {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; OpenStreetMap contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm);
    this.#workouts.forEach(this._renderWorkoutMarker);
  };

  _showForm = (mapE) => {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  };

  _hideForm = () => {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.classList.add('hidden');
    setTimeout(() => form.classList.remove('hidden'), 1000);
  };

  _toggleElevationField = () => {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  };

  _handleNewWorkout = (e) => {
    e.preventDefault();

    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    const type = inputType.value;
    const distance = Number(inputDistance.value);
    const duration = Number(inputDuration.value);
    const { lat, lng } = this.#mapEvent.latlng;

    let workout;

    if (type === 'running') {
      const cadence = Number(inputCadence.value);
      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence)) {
        return alert('Inputs must be positive numbers!');
      }
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevationGain = Number(inputElevation.value);
      if (!validInputs(distance, duration, elevationGain) || !allPositive(distance, duration)) {
        return alert('Inputs must be positive numbers!');
      }
      workout = new Cycling([lat, lng], distance, duration, elevationGain);
    }

    this.#workouts.push(workout);
    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._saveToLocalStorage();
  };

  _renderWorkoutMarker = (workout) => {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          closeOnClick: false,
          autoClose: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  };

  _renderWorkout = (workout) => {
    const html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        ${this._generateWorkoutDetails(workout)}
      </li>
    `;
    form.insertAdjacentHTML('afterend', html);
  };

  _generateWorkoutDetails = (workout) => {
    let details = `
      <div class="workout__details">
        <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
    `;

    if (workout.type === 'running') {
      details += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      `;
    }

    if (workout.type === 'cycling') {
      details += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      `;
    }

    return details;
  };

  _moveToPopup = (e) => {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl || !this.#map) return;

    const workout = this.#workouts.find((w) => w.id === workoutEl.dataset.id);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  };

  _saveToLocalStorage = () => {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  };

  _loadLocalStorage = () => {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data.map((workout) => {
      if (workout.type === 'running') {
        return Object.assign(new Running(), workout);
      } else if (workout.type === 'cycling') {
        return Object.assign(new Cycling(), workout);
      }
      return workout;
    });

    this.#workouts.forEach(this._renderWorkout);
  };
}

new App();