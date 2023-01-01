// Note: can't use "strict mode" since we need to eval() non-strict code from the user

var rowPattern = /^(?<leadingOperation>[\+\-\*\/])?(?<expression>.*?)(#.*(?<type>hex|oct|bin))?$/i
var saveDataTimeout = 0;

var hashEventListener = function() {
	$inputArea = $('#inputArea');
	var dataFromHash = loadData($inputArea);
	if ($inputArea.val() !== dataFromHash) {
		$inputArea.val(dataFromHash);
		$inputArea.trigger('properychange')
	}
}

var saveData = function($inputArea, delayTime) {
	// Only update hash when a hashtag is present
	if (window.location.hash || /#$/.test(window.location.href)) {
		// Save is done after a given delay. If a save is pending, push it back to <delayTime>.
		clearTimeout(saveDataTimeout);
		saveDataTimeout = setTimeout(() => {
			var rawBytes = Uint8Array.from($inputArea.val(), c => c.charCodeAt(0));
			var compressedBytes = pako.deflate(rawBytes);
			var encoded = null;
			if (rawBytes.length < (compressedBytes.length + 15)) {
				encoded = btoa(String.fromCharCode.apply(null, rawBytes));
			} else {
				encoded = "gzip=" + btoa(String.fromCharCode.apply(null, compressedBytes));
			}
			window.location.hash = encoded;
			console.log(encoded)
		}, delayTime || 0)
	} else {
		// Fallback to local storage when there isn't a hashtag
		localStorage.setItem('notePadValue', $inputArea.val());
	}
}

var loadData = function($inputArea) {
	var localContent = localStorage.getItem('notePadValue');
	var hashContent = null;
	
	try {
		hashContent = window.location.hash.substring(1);
		if (hashContent.startsWith("gzip=")) {
			hashContent = String.fromCharCode.apply(null, pako.inflate(Uint8Array.from(atob(hashContent.replace("gzip=","")), c => c.charCodeAt(0))));
		} else if (hashContent.startsWith("b64=")) {
			hashContent = String.fromCharCode.apply(null, pako.inflate(Uint8Array.from(atob(hashContent.replace("gzip=","")), c => c.charCodeAt(0))));
		} else {
			hashContent = atob(hashContent);
		}

		if (hashContent.trim().length <= 1) {
			hashContent = null;
		}
	} catch {
		window.location.hash = btoa($inputArea.val())
	}

	return hashContent || localContent;
}

addEventListener('hashchange', hashEventListener);

$(document).ready(function () {
	var $ = window.$;

	var exampleCalculation = 
		"Edit any of the following calculations,\n" +
		"or delete them all and start from scratch!\n" +
		"\n" +
		"\n" +
		"Simple Arithmetic\n" +
		"-----------------\n" +
		"\n" +
		"How many weeks in a month?\n" +
		"52 / 12\n" +
		"\n" +
		"How many weekdays in a month?\n" +
		"* 5\n" +
		"\n" +
		"\n" +
		"Use Of Variables\n" +
		"-------------------\n" +
		"\n" +
		"costPerEgg = 1.5\n" +
		"eggsPerCarton = 6\n" +
		"costPerCarton = eggsPerCarton * costPerEgg\n" +
		"numberOfCartons = 60\n" +
		"\n" +
		"totalCost = costPerCarton * numberOfCartons\n" +
		"\n" +
		"\n" +
		"Conversions\n" +
		"-------------------\n" +
		"\n" +
		"12 cm to inches\n" +
		"2 litres to cups\n" +
		"1000 sqyard in hectares\n" +
		"5000 watts to hp\n" +
		"30 BTU in Wh\n" +
		"3 decades in minutes\n" + 
		"\n" +
		"\n" +
		"Number Formats\n" +
		"-------------------\n" +
		"\n" +
		"255 #hex\n" +
		"255 #oct\n" +
		"255 #bin\n";

	var $inputArea = $('#inputArea'),
		$outputArea = $('#outputArea');

	var previousAnswerLines = []; // keep copy of old answers to see what changed

	var calculateAnswers = function () {
		if (!introPlaying) {
			// Save data in the next 3 seconds on change
			saveData($inputArea, 3000);
		}

		var lines = $inputArea.val().split('\n');

		var outputLines = [];
		var context = {};

		var previousAnswerIndex;

    // Calculate answers using math.evaluate()
		$.each(lines, function (i, line) {
			try {
				lineData = rowPattern.exec(line).groups;

				if (line.length > 0) {
          // If the line starts with an operator (+, -, *, /), prepend the previous answer
					if (lineData.leadingOperation && outputLines[previousAnswerIndex]) {
						lineData.expression = "ans " + lineData.leadingOperation + lineData.expression;
					}

					if (lineData.type) {
						lineData.expression = 'format(' + lineData.expression + ', {notation: "' + lineData.type.toLowerCase() + '"})';
					}

					var answer = math.evaluate(lineData.expression, context);

					if (typeof(answer) === "number" || typeof(answer) === "string" || answer instanceof math.Unit) {
						outputLines[i] = answer;
					}

					context["ans"] = answer;
					
					previousAnswerIndex = i;
				} else {
					outputLines[i] = null;
				}
			} catch (err) {
				outputLines[i] = null;
			}
		});

		var rows = [];
		var DECIMAL_PERCISION = 4;
		$.each(outputLines, function (index, line) {
			var row;
			if (line instanceof math.Unit || typeof(line) === "number") {
				row = math.format(line, DECIMAL_PERCISION)
			} else if (typeof(line) === "string") {
				row = line;
			} else {
				row = '&nbsp;';
			}

      // add "changed" class to highlight the new and changed answers since last calculation
			if (!previousAnswerLines || math.format(previousAnswerLines[index], DECIMAL_PERCISION) !== row) {
				row = '<span class="changed">' + row + '</span>';
			}
			rows.push('<li>' + row + '</li>');
		});

		$outputArea.html(rows.join(''));
		previousAnswerLines = outputLines;
	};

	var NUM_ROWS = 50;

	$inputArea.attr('rows', NUM_ROWS);

	// Add horizontal ruler lines
	var rulerLines = [];
	for (var i = 0; i < NUM_ROWS; i++) {
		rulerLines.push('<li>&nbsp;</li>');
	}
	$('.backgroundRuler').html(rulerLines.join(''));
	
	$inputArea.on('input properychange', calculateAnswers);
	$inputArea.blur(() => saveData($inputArea, 0)); // save immediatly on focus lost
	
  // fetch initial calculations from localStorage
	var initialString = loadData($inputArea);

	if (initialString) {
		$inputArea.val(initialString);
		calculateAnswers();
		$inputArea.focus();
	} else {
    // if no inital calculations - play the intro example...
		$inputArea.val("");
		$inputArea.attr('disabled', 'disabled');
		initialString = exampleCalculation;
		var introPlaying = true;

		var addCharacter = function (character) {
			$inputArea.val($inputArea.val() + character);
			calculateAnswers();
		};

		var charIndex = 0;
		var charsPerIteration = 4;

		var printInitialLines = function () {
			if (charIndex < initialString.length) {
				var thisCharacter = initialString.slice(charIndex, charIndex + charsPerIteration);
				charIndex += charsPerIteration;

				setTimeout(function () {
					addCharacter(thisCharacter);
					printInitialLines();
				}, 20);
			} else {
				introPlaying = false;
				$inputArea.removeAttr('disabled');
				$inputArea.focus();
			}
		};

		printInitialLines();
	}
});
