/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

function init()
{
	// window resize stop listener
	(function()
	{
		let last      = 0;
		let timer     = 0;
		let threshold = 1000;
		let callbacks = [];

		window.addEventListener('resize', function()
		{
			last = Date.now();
			timer = timer || window.setTimeout(function() checkTime(), 10);
		}, false);

		window.resizeStopListener =
		{
			add : function(aCallback)
			{
				if (callbacks.indexOf(aCallback) < 0)
				{
					callbacks.push(aCallback);
				}
			},
			remove : function(aCallback)
			{
				let index = callbacks.indexOf(aCallback);

				if (index >= 0)
				{
					callbacks.splice(index, 1);
				}
			}
		}

		function checkTime()
		{
			let now = Date.now();
			if (now - last < threshold)
			{
				//window.clearTimeout(timer);
				timer = window.setTimeout(function() checkTime(), 10);
			}
			else
			{
				window.clearTimeout(timer);
				timer = last = 0;

				for (let i = 0; i < callbacks.length; i++)
				{
					callbacks[i]();
				}
			}
		}
	})();

	document.addEventListener('contextmenu', Launchpad.events.disableEvent, false);

	Launchpad.bookmarks.load(Prefs.bookmarksFolderID);
	Launchpad.dialpad.init();
	Launchpad.button.init();

	function resizeView()
	{
		Launchpad.dialpad.resetCurrent();
		Launchpad.button.resetCurrent();

		let thumbnailElements = document.querySelectorAll('.' + DIALPAD_BUTTON_THUMBNAIL_CLASS);

		for (let i = 0; i < thumbnailElements.length; i++)
		{
			thumbnailElements[i].style.imageRendering = '-moz-crisp-edges';
		}

		Launchpad.button.resetPosition();
	}

	PrefListener.add(listener);
	window.addEventListener('beforeunload', function(e) PrefListener.remove(listener), false);

	function listener(aName, aValue)
	{
		switch (aName)
		{
			case 'dialpadButtonRatio':
			case 'dialpadButtonAutosizeEnabled':
				resizeView();
				break;
		}
	}

	mainWindow.addEventListener('keydown', closeLaunchpad, false);
	window.addEventListener('beforeunload', function(e) mainWindow.removeEventListener('keydown', closeLaunchpad), false);
	window.addEventListener('click', closeLaunchpad, false);

	function closeLaunchpad(aEvent, aEscKey)
	{
		let eventType = aEvent.type;

		switch (eventType)
		{
			case 'keydown':
				if (aEvent.keyCode != 27) return;
				break;

			case 'click':
				if (aEvent.button != 0) return;
				break;

			default:
				return;
		}

		let popups = document.querySelectorAll('.popup');
		let popupOpened = false;
		let popupLocked = false;

		for (let i = 0; i < popups.length; i++)
		{
			let popup = popups[i];
			if (popup.classList.contains('active'))
			{
				popupOpened = true;

				if (eventType == 'click')
				{
					let {clientX, clientY} = aEvent;
					let {left, top, right, bottom} = popup.getBoundingClientRect()
					if (clientX > left && clientX < right && clientY > top && clientY < bottom)
					{
						popupLocked = true;
						break;
					}
				}
			}
		}

		if (popupOpened)
		{
			if ( ! popupLocked || eventType == 'keydown')
			{
				Launchpad.popup.hide();
			}

			return;
		}
		else
		{
			mainWindow.ToggleLaunchpadWindow(false);
		}
	}

	window.addEventListener('resize', resizeView, true);

	window.resizeStopListener.add(function()
	{
		let thumbnailElements = document.querySelectorAll('.' + DIALPAD_BUTTON_THUMBNAIL_CLASS);

		for (let i = 0; i < thumbnailElements.length; i++)
		{
			thumbnailElements[i].style.imageRendering = 'auto';
		}
	});

	// replace input[type='range']
	(function()
	{
		let event = document.createEvent('HTMLEvents');
		event.initEvent('change', false, true);

		let slider = document.createElementNS(HTML_NAMESPACE, 'div');
		slider.classList.add('range-slider');

		let _scaleplate = document.createElementNS(HTML_NAMESPACE, 'div');
		_scaleplate.classList.add('scaleplate');
		slider.appendChild(_scaleplate);

		let _track = document.createElementNS(HTML_NAMESPACE, 'div');
		_track.classList.add('track');
		_track.appendChild(document.createElementNS(HTML_NAMESPACE, 'span'));
		slider.appendChild(_track);

		let _thumb = document.createElementNS(HTML_NAMESPACE, 'button');
		_thumb.classList.add('thumb');
		_thumb.appendChild(document.createElementNS(HTML_NAMESPACE, 'span'));
		slider.appendChild(_thumb);

		let fragment = document.createDocumentFragment();
		fragment.appendChild(slider)

		let options =
		{
			attributes: true,
			attributeFilter: ['min', 'max', 'step', 'value', 'readOnly', 'data-scales']
		};

		Array.prototype.forEach.call(document.querySelectorAll('input[type=range]'), replace);

		function replace(aInput)
		{
			let slider, scaleplate, track, thumb;
			init()

			function updateScaleplate()
			{
				if (aInput.dataset.scales)
				{
					let scales = aInput.dataset.scales.replace(/\s+/g, '').split(',');
					if (scales.length)
					{
						while (scaleplate.firstChild)
						{
							scaleplate.removeChild(scaleplate.firstChild);
						}

						let {min, max, width} = getSliderValue();

						for (let n = 0; n < scales.length; n++)
						{
							let scale = parseFloat(scales[n]);
							if (scale < min || scale > max)
							{
								continue;
							}

							let line = document.createElementNS(HTML_NAMESPACE, 'span');
							line.style.left = Math.round(((scale - min) / (max - min)) * width) + 'px';
							scaleplate.appendChild(line);
						}
					}
				}
			}

			function eventHandler(e)
			{
				if (aInput.readOnly == true)
				{
					return;
				}
				let [value, left] = calc(e);
				aInput.value = value;
				dispatchEvent();
				thumb.style.left = left + 'px';
			}

			function calc(aEvent)
			{
				let {min, max, step, width, left} = getSliderValue();
				let maxStepPower = (max - min) / step;
				let mouseX = aEvent.clientX - left;
				let stepPower = Math.max(Math.min(Math.round(maxStepPower * (mouseX / width)), maxStepPower), 0);
				return [stepPower * step + min, Math.round((stepPower / maxStepPower) * width)];
			}

			function getSliderValue()
			{
				let min = aInput.min;
				let max = aInput.max;
				let step = aInput.step;
				let value = aInput.value;

				(min == '' || isNaN((min = parseFloat(min)))) && (min = 0);
				(max == '' || isNaN((max = parseFloat(max)))) && (max = 100);
				(step == '' || isNaN((step = parseFloat(step)))) && (step = 1);
				(value == '' || isNaN((value = parseFloat(value)))) && (value = (max < min) ? min : (min + (max - min) / 2));

				return {min : min, max : max, step : step, value : value, width : slider.offsetWidth, left : slider.getBoundingClientRect().left};
			}

			function dispatchEvent()
			{
				aInput.onchange && aInput.onchange(event);
				aInput.dispatchEvent(event);
			}

			function bindEvents()
			{
				track.addEventListener('click', eventHandler, false);
				thumb.addEventListener('mousedown', mousedown, false);

				function mousedown()
				{
					document.addEventListener('mouseup', mouseup, false);
					document.addEventListener('mousemove', eventHandler, false);
				}

				function mouseup()
				{
					document.removeEventListener('mouseup', mouseup);
					document.removeEventListener('mousemove', eventHandler);
				}

				aInput.addEventListener('change', function(e)
				{
					let {min, max, width} = getSliderValue();
					thumb.style.left = Math.round(((e.currentTarget.value - min) / (max - min)) * width) + 'px';
				}, false);

				let value = aInput.value;
				Object.defineProperty(aInput, 'value',
				{
					get : function() value,
					set : function(aValue)
					{
						let {min, max} = getSliderValue();
						(aValue < min) && (aValue = min);
						(aValue > max) && (aValue = max);
						value = aValue;
						aInput.setAttribute('value', value);
					}
				});

				let readOnly = aInput.readOnly;
				Object.defineProperty(aInput, 'readOnly',
				{
					get : function() readOnly,
					set : function(aValue)
					{
						readOnly = aValue == true ? true : false;
						slider.setAttribute('readOnly', readOnly);
						aInput.setAttribute('readOnly', readOnly);
					}
				});

				new window.MutationObserver(function(mutations)
				{
					mutations.forEach(function(mutation)
					{
						switch (mutation.attributeName)
						{
							case 'value':
								dispatchEvent();
								break;

							case 'min':
							case 'max':
							case 'data-scales':
								updateScaleplate();
								break;
						}
					});
				}).observe(aInput, options);
			}

			function init()
			{
				let node = fragment.cloneNode(true);
				slider = node.firstChild;
				scaleplate = slider.querySelector('.scaleplate');
				track = slider.querySelector('.track');
				thumb = slider.querySelector('.thumb');

				slider.setAttribute('readOnly', aInput.readOnly == true ? true : false);

				let {min, max, step, value, width} = getSliderValue();
				aInput.setAttribute('min', min);
				aInput.setAttribute('max', max);
				aInput.setAttribute('step', step);
				aInput.setAttribute('value', value);
				thumb.style.left = Math.round(((value - min) / (max - min)) * width) + 'px';

				aInput.style.display = 'none';
				aInput.parentNode.insertBefore(node, aInput);
				updateScaleplate();
				bindEvents();
			}
		}
	})();

	// settings
	(function()
	{
		let button = document.getElementById('settings-button');
		let panel = document.getElementById('settings-panel');
		button.addEventListener('click', function(e)
		{
			e.preventDefault();
			e.stopPropagation();
			e.button == 0 && Launchpad.popup.show(panel, button);
		}, false);

		let zoomMode = document.getElementById('zoom-mode');
		let zoomAdjuster = document.getElementById('zoom-adjuster');
		let zoomPercentage = document.getElementById('zoom-percentage');
		zoomMode.value = Prefs.dialpadButtonAutosizeEnabled << 0;

		zoomAdjuster.value = Prefs.dialpadButtonRatio * 100;
		zoomAdjuster.readOnly = Prefs.dialpadButtonAutosizeEnabled;
		zoomPercentage.textContent = (Prefs.dialpadButtonRatio * 100) + '%';
		zoomAdjuster.addEventListener('change', function(e)
		{
			let value = Math.round(zoomAdjuster.value);
			Prefs.dialpadButtonRatio = value / 100;
			zoomPercentage.textContent = value + '%';
		}, false);

		zoomMode.addEventListener('change', function(e)
		{
			let value = zoomMode.value == 1;
			Prefs.dialpadButtonAutosizeEnabled = value;
			zoomAdjuster.readOnly = value;
		}, false);

		PrefListener.add(listener);
		window.addEventListener('beforeunload', function(e) PrefListener.remove(listener), false);

		function listener(aName, aValue)
		{
			switch (aName)
			{
				case 'dialpadButtonRatio':
					zoomAdjuster.value = aValue * 100;
					break;

				case 'dialpadButtonAutosizeEnabled':
					zoomMode.value = aValue << 0;
					break;
			}
		}
	})();

	// add bookmark panel
	(function()
	{
		let panel = document.getElementById('add-bookmark-panel');
		let form = panel.querySelector('form');
		let input = form.querySelector('input');

		form.querySelector('button[type="reset"]').addEventListener('click', function(e)
		{
			e.preventDefault();
			e.stopPropagation();
			Launchpad.popup.hide();
		}, false);

		form.addEventListener('submit', function(e)
		{
			e.preventDefault();
			e.stopPropagation();

			let uri = input.value.trim();

			if (uri)
			{
				let bookmarks = Launchpad.bookmarks;
				bookmarks.add(
					{
						uri      : uri,
						title    : '',
						type     : bookmarks.TYPE_BOOKMARK,
						index    : bookmarks.DEFAULT_INDEX,
						folderID : bookmarks.folderID
					});

				Launchpad.popup.hide();
			}
		}, false);
	}());

	// edit bookmark panel
	(function()
	{
		let panel = document.getElementById('edit-bookmark-panel');
		let form = panel.querySelector('form');
		let uriControl = form.querySelector('input[type="url"]');
		let titleControl = form.querySelector('input[type="text"]');

		form.querySelector('button[type="reset"]').addEventListener('click', function(e)
		{
			e.preventDefault();
			e.stopPropagation();
			Launchpad.popup.hide();
		}, false);

		form.addEventListener('submit', function(e)
		{
			e.preventDefault();
			e.stopPropagation();

			let uri = uriControl.value.trim();
			let title = titleControl.value.trim();

			if (uri)
			{
				let bookmarks = Launchpad.bookmarks;
				bookmarks.update(
					{
						id    : panel.oID,
						uri   : uri,
						title : title,
						type  : bookmarks.TYPE_BOOKMARK
					});

				Launchpad.popup.hide();
			}
		}, false);
	}());
}

window.addEventListener('load', init, false);
