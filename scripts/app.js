var app = angular.module('sequential', []);

app.filter('range', function() {
	return function(input, total) {
		total = parseInt(total, 10);
		for (var i = 0; i < total; i++) {
			input.push(i);
		}
		return input;
	};
});

app.factory('AudioContext', function() {
	var ctx = new webkitAudioContext();
	//need to create a node to kick off the timer
	ctx.createGain();
	return ctx;
});

app.factory('Sounds', function(AudioContext, $http) {
	var loadedSounds = {
		closedhat: null,
		floortom: null,
		hitom: null,
		kick: null,
		lowtom: null,
		midtom: null,
		openhat: null,
		ride: null,
		snare: null
	};
	var loadSound = function(instrument) {
		if (loadedSounds[instrument]) { return; }
		var request = new XMLHttpRequest();
		request.open('GET', './sounds/' + instrument + '/' + '5B.wav', true);
		request.responseType = 'arraybuffer';
		request.onload = function() {
			var data = request.response;
			AudioContext.decodeAudioData(data, decoded);
		};
		request.send();
		function decoded(buf) {
			loadedSounds[instrument] = buf;
		}
	};
	var getBuffer = function(instrument) {
		if (loadedSounds[instrument]) {
			return loadedSounds[instrument];
		} else {
			loadSound(instrument);
		}
	};
	return {
		loadSound: loadSound,
		getBuffer: getBuffer
	};
});

app.factory('Clock', function() {
	var settings = {
		lookahead: 25, //milliseconds
		scheduleAheadTime: 0.1 //seconds
	};
	var state = {
		clickQueue: [],
		nextClickTime: 0,
		timer: 0,
		beat: 1,
		subdivision: 1,
		lastClickRendered: 0
	};
	var reset = function() {
		state.clickQueue = [];
		state.beat = 1;
		state.subdivision = 1;
		state.lastClickRendered = 0;
		state.timer = 0;
		state.nextClickTime = 0;
	};
	return {
		settings: settings,
		state: state,
		reset: reset
	};
});

app.controller('MainCtrl', function($scope, AudioContext, Sounds, Clock) {
	$scope.userInput = {
		tempo: 110,
		beats: 4,
		subdivisions: 4
	};
	$scope.sequencer = {
		isPlaying: false,
		isPaused: false
	};
	$scope.view = {
		width: 500,
		height: 300,
		padding: {
			top: 0,
			right: 0,
			bottom: 0,
			left: 74
		},
		blockSize: 30,
		blockPadding: 6,
		markerSize: 30,
		markerPosition: 80,
		beatMarkerPosition: 74,
		beatSpacing: 10
	};

	//creates an empty array of a specified length, for use with ng-repeat
	$scope.getNumber = function(num) {
		return new Array(num);
	};

	$scope.safeApply = function(fn) {
		var phase = this.$root.$$phase;
		if(phase == '$apply' || phase == '$digest') {
			if(fn && (typeof(fn) === 'function')) {
				fn();
			}
		} else {
			this.$apply(fn);
		}
	};
	$scope.availableInstruments = [
		{ name: 'Ride Cymbal', value: 'ride', selected: false, blocks: [] },
		{ name: 'Hi-Hat', value: 'closedhat', selected: true, blocks: [] },
		{ name: 'High Tom', value: 'hitom', selected: false, blocks: [] },
		{ name: 'Mid Tom', value: 'midtom', selected: false, blocks: [] },
		{ name: 'Low Tom', value: 'lowtom', selected: false, blocks: [] },
		{ name: 'Snare Drum', value: 'snare', selected: true, blocks: [] },
		{ name: 'Kick Drum', value: 'kick', selected: true, blocks: [] }
	];
	$scope.getInstrumentCount = function() {
		var count = 0;
		for (var i = 0; i < $scope.availableInstruments.length; i++) {
			if ($scope.availableInstruments[i].selected) {
				count++;
			}
		}
		return count;
	};
	$scope.nextClick = function() {
		var secondsPerBeat = 60 / $scope.userInput.tempo;
		var secondsPerSubdivision = secondsPerBeat / $scope.userInput.subdivisions;
		Clock.state.nextClickTime += secondsPerSubdivision;
		if (Clock.state.subdivision < $scope.userInput.subdivisions) {
			Clock.state.subdivision++;
		} else {
			Clock.state.subdivision = 1;
			if (Clock.state.beat < $scope.userInput.beats) {
				Clock.state.beat++;
			} else {
				Clock.state.beat = 1;
			}
		}
	};
	$scope.scheduleClick = function(time) {
		var subdivisions = $scope.userInput.subdivisions;
		Clock.state.clickQueue.push({time: time, beatNumber: Clock.state.beat, subdivisionNumber: Clock.state.subdivision});

		var tick = ((subdivisions * (Clock.state.beat - 1)) + Clock.state.subdivision) - 1;
		for (var i = 0; i < $scope.availableInstruments.length; i++) {
			if ($scope.availableInstruments[i].selected) {
				var instrumentSource = AudioContext.createBufferSource();
				if ($scope.availableInstruments[i].blocks[tick].active) {
					var vol = AudioContext.createGain();
					vol.gain.value = $scope.availableInstruments[i].blocks[tick].velocity / 8;
					instrumentSource.buffer = Sounds.getBuffer($scope.availableInstruments[i].value);
					instrumentSource.connect(vol);
					vol.connect(AudioContext.destination);
					instrumentSource.start(time);
				}
			}
		}
	};
	$scope.scheduler = function() {
		while(Clock.state.nextClickTime < AudioContext.currentTime + Clock.settings.scheduleAheadTime) {
			$scope.scheduleClick(Clock.state.nextClickTime);
			$scope.nextClick();
		}
		Clock.state.timer = window.setTimeout($scope.scheduler, Clock.settings.lookahead);
	};

	$scope.getBeatClass = function(beat_number) {
		var classes = [];
		classes.push('beat');
		if ($scope.sequencer.isPlaying || $scope.sequencer.isPaused) {
			if ($scope.currentMarks.beat === beat_number) {
				classes.push('playing');
			}
		}
		return classes.join(' ');
	}

	$scope.getBlockClass = function(block) {
		var classes = [];
		classes.push('block');
		if (block.active) {
			classes.push('active');
			classes.push('vel' + block.velocity.toString());
		}
		if ($scope.sequencer.isPlaying || $scope.sequencer.isPaused) {
			if ($scope.currentMarks.beat === block.beat && $scope.currentMarks.subdivision === block.subdivision) {
				classes.push('playing');
			}
		}
		return classes.join(' ');
	};

	$scope.showHideVelocityControls = function(block) {
		return block.hovered && block.active ? true : false;
	};

	$scope.currentMarks = {
		beat: 1,
		subdivision: 1
	};

	$scope.draw = function() {
		if ($scope.sequencer.isPlaying === false || $scope.sequencer.isPaused) { return; }
		var currentClick = Clock.state.lastClickRendered;
		var t = AudioContext.currentTime;

		while (Clock.state.clickQueue.length && Clock.state.clickQueue[0].time < t) {
			currentClick = ((Clock.state.clickQueue[0].beatNumber - 1) * $scope.userInput.subdivisions) + (Clock.state.clickQueue[0].subdivisionNumber - 1);
			Clock.state.clickQueue.splice(0,1);   // remove click from queue
		}
		if (Clock.state.lastClickRendered != currentClick) {
			$scope.safeApply(function(){
				$scope.currentMarks = {
					beat: Clock.state.beat,
					subdivision: Clock.state.subdivision
				};
			});
			Clock.state.lastClickRendered = currentClick;
		}

		window.requestAnimationFrame($scope.draw);
	};

	$scope.startPlayback = function() {
		$scope.sequencer.isPlaying = true;
		$scope.sequencer.isPaused = false;
		$scope.safeApply();
		Clock.state.nextClickTime = AudioContext.currentTime;
		$scope.scheduler();
		$scope.draw();
	};
	$scope.pausePlayback = function() {
		window.clearTimeout(Clock.state.timer);
		$scope.sequencer.isPlaying = false;
		$scope.sequencer.isPaused = true;
	};
	$scope.stopPlayback = function() {
		window.clearTimeout(Clock.state.timer);
		Clock.reset();
		$scope.sequencer.isPlaying = false;
		$scope.sequencer.isPaused = false;
		$scope.currentMarks = {
			beat: 1,
			subdivision: 1
		};
	};

	$scope.resetGridData = function() {
		for (var i = 0; i < $scope.availableInstruments.length; i++) {
			$scope.availableInstruments[i].blocks = [];
			for (var b = 1; b <= $scope.userInput.beats; b++) {
				for (var s = 1; s <= $scope.userInput.subdivisions; s++) {
					$scope.availableInstruments[i].blocks.push({
						beat: b,
						subdivision: s,
						active: false,
						velocity: 4
					});
				}
			}
		}
	};
	$scope.resetInstrument = function(instrument) {
		for (var i = 0; i < $scope.availableInstruments.length; i++) {
			if ($scope.availableInstruments[i].value === instrument) {
				$scope.availableInstruments[i].blocks = [];
				for (var b = 1; b <= $scope.userInput.beats; b++) {
					for (var s = 1; s <= $scope.userInput.subdivisions; s++) {
						$scope.availableInstruments[i].blocks.push({
							beat: b,
							subdivision: s,
							active: false,
							velocity: 4
						});
					}
				}
				break;
			}
		}
	};
	$scope.initialize =  function() {
		for (var i = 0; i < $scope.availableInstruments.length; i++) {
			Sounds.loadSound($scope.availableInstruments[i].value);
		}
		$scope.resetGridData();
	};
	$scope.initialize();
});
