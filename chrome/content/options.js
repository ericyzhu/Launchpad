/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Cu.import('resource://gre/modules/PluralForm.jsm');

let {KeysMap : {KEYCODES, MODIFIERS}} = require('KeysMap');
let {Prefs, PrefListener} = require('Prefs');
let {Localization} = require('Localization');
let locale = Localization.getBundle('locale');
let getString, captureDelaySecondsLabel, captureTimeoutSecondsLabel;

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const OS = Services.appinfo.OS;

function updateSecondsLabel(aEvent)
{
	let {id, value} = aEvent.target;
	let secondsText = PluralForm.get(value, getString('seconds'));
	switch (id)
	{
		case 'pref-capture-delay':
			captureDelaySecondsLabel.value = secondsText;
			break;

		case 'pref-capture-timeout':
			captureTimeoutSecondsLabel.value = secondsText;
			break;
	}
}

function createkeystrokeRecorder(aControl)
{
	let keystrokeRecorderDisplay, keystrokeRecorderInput, clearButton, prefName, originalKeystrokeRecorderValue = '';

	prefName = aControl.getAttribute('prefname');
	keystrokeRecorderDisplay = document.createElementNS(HTML_NAMESPACE, 'input');
	keystrokeRecorderDisplay.id = prefName;
	keystrokeRecorderDisplay.placeholder = locale.clickToRecordShortcut;
	keystrokeRecorderDisplay.classList.add('keystroke-recorder-display');

	keystrokeRecorderInput = document.createElementNS(HTML_NAMESPACE, 'input');
	keystrokeRecorderInput.classList.add('keystroke-recorder-input');

	clearButton = document.createElementNS(HTML_NAMESPACE, 'img');
	clearButton.setAttribute('src', 'chrome://launchpad-mozest-org/skin/icons/clear.svg');

	aControl.appendChild(keystrokeRecorderDisplay);
	aControl.appendChild(keystrokeRecorderInput);
	aControl.appendChild(clearButton);

	let modifiers = [];
	let keycode;
	let pressedKeys = [];
	keystrokeRecorderInput.addEventListener('keydown', function(e)
	{
		preventDefaultEvent(e);

		let code = e.keyCode;

		if (code == 27)
		{
			keystrokeRecorderInput.blur();
			return;
		}

		if (pressedKeys.indexOf(code) < 0)
		{
			pressedKeys.push(code);

			let shortcut;
			if (code in MODIFIERS)
			{
				(modifiers.indexOf(code) < 0) && modifiers.push(code);
			}
			else if (code in KEYCODES && (modifiers.length || (code >= 112 && 135 >= code)))
			{
				keycode = code;
			}
			updateDisplay({modifiers : modifiers, keycode : keycode});
			if (keycode)
			{
				Prefs[prefName] =
				{
					modifiers : modifiers,
					keycode  : keycode
				};
				keystrokeRecorderInput.blur();
			}
		}

	}, false);

	keystrokeRecorderInput.addEventListener('keyup', function(e)
	{
		let code = e.keyCode;
		let pressedKeyIndex = pressedKeys.indexOf(code);
		let modifiersIndex = modifiers.indexOf(code);

		(pressedKeyIndex >= 0) && pressedKeys.splice(pressedKeyIndex, 1);
		(modifiersIndex >= 0) && modifiers.splice(modifiersIndex, 1);
		updateDisplay({modifiers : modifiers, keycode : keycode});
	}, false);

	keystrokeRecorderInput.addEventListener('blur', function(e)
	{
		( ! keycode) && (keystrokeRecorderDisplay.setAttribute('value', ''));

		if (keystrokeRecorderDisplay.getAttribute('value') && keystrokeRecorderDisplay.getAttribute('value') != originalKeystrokeRecorderValue)
		{
			originalKeystrokeRecorderValue = keystrokeRecorderDisplay.getAttribute('value');
		}
		else
		{
			keystrokeRecorderDisplay.setAttribute('value', originalKeystrokeRecorderValue);
		}
		keystrokeRecorderDisplay.placeholder = locale.clickToRecordShortcut;
		keystrokeRecorderDisplay.setAttribute('focused', false);
		modifiers = [];
		keycode = null;
		pressedKeys = [];
		updateClearButton();
		keystrokeRecorderDisplay.removeAttribute('focused');
	}, false);

	keystrokeRecorderDisplay.addEventListener('mousedown', function(e)
	{
		preventDefaultEvent(e);

		if (keystrokeRecorderDisplay.hasAttribute('focused'))
		{
			return;
		}

		(e.button == 0) && onKeystrokeRecorderFocus(e);
	}, false);

	keystrokeRecorderDisplay.addEventListener('focus', onKeystrokeRecorderFocus, false);

	clearButton.addEventListener('click', function(e)
	{
		Prefs[prefName] = null;
		updateDisplay(null);
		updateClearButton();
	}, false);

	keystrokeRecorderDisplay.addEventListener('contextmenu', preventDefaultEvent, false);
	window.addEventListener('blur', function(e) keystrokeRecorderInput.blur(), false);

	updateDisplay(Prefs[prefName]);
	updateClearButton();

	PrefListener.add(listener);
	window.addEventListener('unload', function(e) PrefListener.remove(listener), false);

	window.addEventListener('click', function()
	{
		keystrokeRecorderInput.blur();
	}, false);

	window.setTimeout(function()
	{
		keystrokeRecorderInput.blur();

	}, 10);

	function listener(aName, aValue)
	{
		switch (aName)
		{
			case prefName:
				updateDisplay(Prefs[prefName]);
				updateClearButton();
				break;
		}
	}

	function onKeystrokeRecorderFocus(e)
	{
		preventDefaultEvent(e);
		keystrokeRecorderDisplay.blur();
		keystrokeRecorderDisplay.value && (originalKeystrokeRecorderValue = keystrokeRecorderDisplay.getAttribute('value'));
		keystrokeRecorderDisplay.setAttribute('focused', true);
		keystrokeRecorderInput.focus();
		keystrokeRecorderDisplay.placeholder = locale.typeShortcut;
		updateDisplay(null);
		updateClearButton();
	}

	function updateDisplay(aShortcut)
	{
		let modifiers = aShortcut && aShortcut.modifiers ? (Array.isArray(aShortcut.modifiers) ? aShortcut.modifiers : []) : [];
		let keycode = aShortcut && aShortcut.keycode ? parseInt(aShortcut.keycode) : 0;
		let strings = [];
		for (let i = 0; i < modifiers.length; i++)
		{
			let [keyName, keyLabel, macKeyLabelCharCode] = MODIFIERS[modifiers[i]];
			if (OS == 'Darwin' && macKeyLabelCharCode > 0)
			{
				strings.push(String.fromCharCode(macKeyLabelCharCode));
			}
			else
			{
				strings.push(keyLabel);
			}
		}

		if (keycode && KEYCODES[keycode])
		{
			let [constantString, keyLabel, macKeyLabelCharCode] = KEYCODES[keycode];
			if (OS == 'Darwin' && macKeyLabelCharCode > 0)
			{
				strings.push(String.fromCharCode(macKeyLabelCharCode));
			}
			else
			{
				strings.push(keyLabel);
			}
		}

		if (OS == 'Darwin')
		{
			keystrokeRecorderDisplay.setAttribute('value', strings.join(''));
		}
		else
		{
			keystrokeRecorderDisplay.setAttribute('value', strings.join('+'));
		}
	}

	function updateClearButton()
	{
		if (keystrokeRecorderInput.getAttribute('focused') || ( ! keystrokeRecorderDisplay.getAttribute('value') && ! keystrokeRecorderInput.getAttribute('focused')))
		{
			clearButton.style.display = 'none';
		}
		else
		{
			clearButton.style.display = '';
		}
	}

	function preventDefaultEvent(e)
	{
		e.stopPropagation();
		e.preventDefault();
	}

	(function()
	{
		let value = keystrokeRecorderDisplay.getAttribute('value');
		Object.defineProperty(keystrokeRecorderDisplay, 'value',
			{
				get : function() value,
				set : function(aValue)
				{
					value = aValue;
					keystrokeRecorderDisplay.setAttribute('value', aValue);

					if (keystrokeRecorderDisplay.getAttribute('focused'))
					{
						keystrokeRecorderDisplay.placeholder = locale.typeShortcut;
					}
					else
					{
						keystrokeRecorderDisplay.placeholder = locale.clickToRecordShortcut;
					}
				}
			});
	})();
}

window.addEventListener('load', function()
{
	Array.prototype.forEach.call(document.querySelectorAll('vbox[class="setting-box keystroke-recorder"]'), createkeystrokeRecorder);
	getString = function(aString) document.getElementById('strings').getString(aString);
	captureDelaySecondsLabel = document.getElementById('capture-delay-seconds-label');
	captureTimeoutSecondsLabel = document.getElementById('capture-timeout-seconds-label');
	captureDelaySecondsLabel.value = PluralForm.get(document.getElementById('capture-delay').value, getString('seconds'));
	captureTimeoutSecondsLabel.value = PluralForm.get(document.getElementById('capture-timeout').value, getString('seconds'));
}, false);
