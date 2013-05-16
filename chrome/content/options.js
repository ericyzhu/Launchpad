/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

let {KeysMap : {KEYCODES, MODIFIERS}} = require('KeysMap');
let {Prefs, PrefListener} = require('Prefs');
let {Localization} = require('Localization');
let locale = Localization.getBundle('locale');

const OS = Services.appinfo.OS;

(function()
{
	let keystrokeRecorderInput = document.getElementById('keystroke-recorder-input');
	let keystrokeRecorder = document.getElementById('keystroke-recorder');
	let clearButton = document.getElementById('clear-shortcut');
	let originalKeystrokeRecorderValue = '';
	keystrokeRecorder.placeholder = locale.clickToRecordShortcut;

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
				Prefs.openLaunchdShortcut =
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
		( ! keycode) && (keystrokeRecorder.setAttribute('value', ''));

		if (keystrokeRecorder.getAttribute('value') && keystrokeRecorder.getAttribute('value') != originalKeystrokeRecorderValue)
		{
			originalKeystrokeRecorderValue = keystrokeRecorder.getAttribute('value');
		}
		else
		{
			keystrokeRecorder.setAttribute('value', originalKeystrokeRecorderValue);
		}
		keystrokeRecorder.placeholder = locale.clickToRecordShortcut;
		keystrokeRecorder.setAttribute('focused', false);
		modifiers = [];
		keycode = null;
		pressedKeys = [];
		updateClearButton();
		keystrokeRecorder.removeAttribute('focused');
	}, false);

	keystrokeRecorder.addEventListener('mousedown', function(e)
	{
		preventDefaultEvent(e);

		if (keystrokeRecorder.hasAttribute('focused'))
		{
			return;
		}

		(e.button == 0) && onKeystrokeRecorderFocus(e);
	}, false);

	keystrokeRecorder.addEventListener('focus', onKeystrokeRecorderFocus, false);

	clearButton.addEventListener('click', function(e)
	{
		Prefs.openLaunchdShortcut = null;
		updateDisplay(null);
		updateClearButton();
	}, false);

	keystrokeRecorder.addEventListener('contextmenu', preventDefaultEvent, false);
	window.addEventListener('blur', function(e) keystrokeRecorderInput.blur(), false);

	updateDisplay(Prefs.openLaunchdShortcut);
	updateClearButton();

	PrefListener.add(listener);
	window.addEventListener('unload', function(e) PrefListener.remove(listener), false);

	window.addEventListener('load', function(e)
	{
		window.setTimeout(function()
		{
			keystrokeRecorder.blur();
			keystrokeRecorderInput.blur();

		}, 10);
	}, false);


	function listener(aName, aValue)
	{
		switch (aName)
		{
			case 'openLaunchdShortcut':
				updateDisplay(Prefs.openLaunchdShortcut);
				updateClearButton();
				break;
		}
	}

	function onKeystrokeRecorderFocus(e)
	{
		preventDefaultEvent(e);
		keystrokeRecorder.blur();
		keystrokeRecorder.value && (originalKeystrokeRecorderValue = keystrokeRecorder.getAttribute('value'));
		keystrokeRecorder.setAttribute('focused', true);
		keystrokeRecorderInput.focus();
		keystrokeRecorder.placeholder = locale.typeShortcut;
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
			keystrokeRecorder.setAttribute('value', strings.join(''));
		}
		else
		{
			keystrokeRecorder.setAttribute('value', strings.join('+'));
		}
	}

	function updateClearButton()
	{
		if (keystrokeRecorderInput.getAttribute('focused') || ( ! keystrokeRecorder.getAttribute('value') && ! keystrokeRecorderInput.getAttribute('focused')))
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
		let value = keystrokeRecorder.getAttribute('value');
		Object.defineProperty(keystrokeRecorder, 'value',
		{
			get : function() value,
			set : function(aValue)
			{
				value = aValue;
				keystrokeRecorder.setAttribute('value', aValue);

				if (keystrokeRecorder.getAttribute('focused'))
				{
					keystrokeRecorder.placeholder = locale.typeShortcut;
				}
				else
				{
					keystrokeRecorder.placeholder = locale.clickToRecordShortcut;
				}
			}
		});
	})();
})();
