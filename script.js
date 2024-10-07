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
    return this.pace;
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
    return this.speed;
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
const sortSelect = document.querySelector('.sort__select');
const deleteAllBtn = document.querySelector('.btn--delete-all');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent = null;
  #workouts = [];
  editingWorkout = null;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._loadLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._handleNewWorkout);
    inputType.addEventListener('change', this._toggleElevationField);
    workoutsContainer.addEventListener('click', this._handleWorkoutClick);
    sortSelect.addEventListener('change', this._sortWorkouts);
    deleteAllBtn.addEventListener('click', this._deleteAllWorkouts);
  }

  _getPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap,
        () => this._showMessage('Could not get your position', 'error')
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
    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  };

  _showForm = (mapE) => {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  };

  _hideForm = () => {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
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

    let workout;

    // Editing existing workout
    if (this.editingWorkout) {
      const workout = this.editingWorkout;
      workout.distance = distance;
      workout.duration = duration;

      if (type === 'running') {
        const cadence = Number(inputCadence.value);
        if (
          !validInputs(distance, duration, cadence) ||
          !allPositive(distance, duration, cadence)
        ) {
          this._showMessage('Inputs must be positive numbers!', 'error');
          return;
        }
        workout.cadence = cadence;
        workout._calcPace();
      }

      if (type === 'cycling') {
        const elevationGain = Number(inputElevation.value);
        if (
          !validInputs(distance, duration, elevationGain) ||
          !allPositive(distance, duration)
        ) {
          this._showMessage('Inputs must be positive numbers!', 'error');
          return;
        }
        workout.elevationGain = elevationGain;
        workout._calcSpeed();
      }

      workout._setDescription();

      // Update UI
      this._updateWorkoutInList(workout);

      // Update marker popup content
      if (workout.marker) {
        workout.marker.setPopupContent(
          `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
        );
      }

      // Save to local storage
      this._saveToLocalStorage();

      // Hide form
      this._hideForm();
      this.editingWorkout = null;
      return;
    }

    // Creating new workout
    const { lat, lng } = this.#mapEvent.latlng;

    if (type === 'running') {
      const cadence = Number(inputCadence.value);
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        this._showMessage('Inputs must be positive numbers!', 'error');
        return;
      }
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevationGain = Number(inputElevation.value);
      if (
        !validInputs(distance, duration, elevationGain) ||
        !allPositive(distance, duration)
      ) {
        this._showMessage('Inputs must be positive numbers!', 'error');
        return;
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
    workout.marker = L.marker(workout.coords)
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
      .openPopup(); // Store marker for later use
  };

  _renderWorkout = (workout) => {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__actions">
          <button class="workout__btn workout__btn--edit">Edit</button>
          <button class="workout__btn workout__btn--delete">Delete</button>
        </div>
        ${this._generateWorkoutDetails(workout)}
      </li>
    `;
    form.insertAdjacentHTML('afterend', html);
  };

  _generateWorkoutDetails = (workout) => {
    let details = `
      <div class="workout__details">
        <span class="workout__icon">${
      workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
    }</span>
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

  _handleWorkoutClick = (e) => {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    if (e.target.classList.contains('workout__btn--delete')) {
      this._deleteWorkout(workoutEl.dataset.id);
    } else if (e.target.classList.contains('workout__btn--edit')) {
      this._editWorkout(workoutEl.dataset.id);
    } else if (workoutEl && this.#map) {
      const workout = this.#workouts.find((w) => w.id === workoutEl.dataset.id);
      this.#map.setView(workout.coords, this.#mapZoomLevel, {
        animate: true,
        pan: { duration: 1 },
      });
    }
  };

  _deleteWorkout = (id) => {
    const index = this.#workouts.findIndex((workout) => workout.id === id);
    if (index === -1) return;

    const workout = this.#workouts[index];

    // Remove marker
    if (workout.marker) {
      this.#map.removeLayer(workout.marker);
    }

    // Remove from workouts array
    this.#workouts.splice(index, 1);

    // Remove from local storage
    this._saveToLocalStorage();

    // Remove from UI
    document.querySelector(`.workout[data-id="${id}"]`).remove();
    this._showMessage('Workout deleted successfully!', 'success');
  };

  _editWorkout = (id) => {
    const workout = this.#workouts.find((w) => w.id === id);
    if (!workout) return;

    // Show form
    form.classList.remove('hidden');
    inputDistance.focus();

    // Fill form with workout data
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (workout.type === 'running') {
      inputCadence.value = workout.cadence;
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    }

    if (workout.type === 'cycling') {
      inputElevation.value = workout.elevationGain;
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.closest('.form__row').classList.remove('form__row--hidden');
    }

    this.editingWorkout = workout;
  };

  _updateWorkoutInList = (workout) => {
    const workoutEl = document.querySelector(`.workout[data-id="${workout.id}"]`);
    workoutEl.querySelector('.workout__title').textContent = workout.description;

    // Remove existing details
    workoutEl.querySelectorAll('.workout__details').forEach((el) => el.remove());

    // Add updated details
    workoutEl.insertAdjacentHTML('beforeend', this._generateWorkoutDetails(workout));

    this._showMessage('Workout updated successfully!', 'success');
  };

  _deleteAllWorkouts = () => {
    if (!confirm('Are you sure you want to delete all workouts?')) return;

    // Clear workouts array
    this.#workouts = [];

    // Clear local storage
    this._saveToLocalStorage();

    // Remove workouts from UI
    document.querySelectorAll('.workout').forEach((el) => el.remove());

    // Remove markers from map
    if (this.#map) {
      this.#map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          this.#map.removeLayer(layer);
        }
      });
    }

    this._showMessage('All workouts deleted!', 'success');
  };

  _sortWorkouts = () => {
    const sortField = sortSelect.value;

    this.#workouts.sort((a, b) => {
      if (sortField === 'date') {
        return new Date(a.date) - new Date(b.date);
      } else {
        return a[sortField] - b[sortField];
      }
    });

    // Remove existing workouts from UI
    document.querySelectorAll('.workout').forEach((el) => el.remove());

    // Re-render sorted workouts
    this.#workouts.forEach((workout) => {
      this._renderWorkout(workout);
    });
  };

  _showMessage = (message, type = 'error') => {
    const html = `<div class="message message--${type}">${message}</div>`;
    document.body.insertAdjacentHTML('afterbegin', html);
    setTimeout(() => {
      document.querySelector('.message').remove();
    }, 3000);
  };

  _saveToLocalStorage = () => {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  };

  _loadLocalStorage = () => {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data.map((workout) => {
      let obj;
      if (workout.type === 'running') {
        obj = new Running(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.cadence
        );
      } else if (workout.type === 'cycling') {
        obj = new Cycling(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.elevationGain
        );
      }
      obj.date = new Date(workout.date);
      obj.id = workout.id;
      obj.description = workout.description;
      return obj;
    });

    this.#workouts.forEach((workout) => {
      this._renderWorkout(workout);
    });
  };
}

new App();