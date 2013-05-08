/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

'use strict';

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');

let applyToWindow = function(aWindow, aWindowType, aCallback)
{
	if (aWindowType == aWindow.document.documentElement.getAttribute('windowtype'))
	{
		try
		{
			aCallback(aWindow);
		}
		catch(e)
		{
			Cu.reportError(e);
		}
	}
}

let listeners = [];

let observer =
{
	register: function()
	{
		Services.ww.registerNotification(this);
	},
	unregister: function()
	{
		Services.ww.unregisterNotification(this);
	},
	observe: function(aSubject, aTopic, aData)
	{
		if (aTopic == 'domwindowopened')
		{
			let window = aSubject.QueryInterface(Ci.nsIDOMWindow);

			for (let i = 0; i < listeners.length; i++)
			{
				let {windowType, event, callback} = listeners[i];

				if ((event == 'DOMContentLoaded' && (window.document.readyState == 'interactive' || window.document.readyState == 'complete')) || (event == 'load' && window.document.readyState == 'complete'))
				{
					applyToWindow(window, windowType, callback);
				}
				else
				{
					let listener = function(aWindowType, aEvent, aCallback)
					{
						applyToWindow(this, aWindowType, aCallback);

						if (aEvent == 'DOMContentLoaded' || aEvent == 'load')
						{
							this.removeEventListener(aEvent, listener, false);
						}
					}.bind(window, windowType, event, callback);

					window.addEventListener(event, listener, false);
				}
			}
		}
	},
	QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference, Ci.nsIObserver])
};

exports.WindowObserver =
{
	addListener: function(aWindowType, aEvent, aCallback)
	{
		aEvent = aEvent == 'ready' ? 'DOMContentLoaded' : aEvent;

		let listener =
		{
			windowType : aWindowType,
			event      : aEvent,
			callback   : aCallback
		};

		if (listeners.indexOf(listener) >= 0)
		{
			return;
		}

		listeners.push(listener);

		let enumerator = Services.wm.getEnumerator(null);

		while (enumerator.hasMoreElements())
		{
			let window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);

			if ((aEvent == 'DOMContentLoaded' && (window.document.readyState == 'interactive' || window.document.readyState == 'complete')) || (aEvent == 'load' && window.document.readyState == 'complete'))
			{
				applyToWindow(window, aWindowType, aCallback);
			}
			else
			{
				observer.observe(window, 'domwindowopened', null)
			}
		}
	},
	removeListener: function(aWindowType, aEvent, aCallback)
	{
		aEvent = aEvent == 'ready' ? 'DOMContentLoaded' : aEvent;

		let listener =
		{
			windowType : aWindowType,
			event      : aEvent,
			callback   : aCallback
		};

		let index = listeners.indexOf(listener);

		if (index >= 0)
		{
			listeners.splice(index, 1);

			let enumerator = Services.wm.getEnumerator(null);
			while (enumerator.hasMoreElements())
			{
				let window = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);

				if (window.document.readyState == 'interactive' || window.document.readyState == 'complete')
				{
					if (window.document.documentElement.getAttribute('windowtype') == aWindowType)
					{
						window.removeEventListener(aEvent, aCallback, false);
					}
				}
			}

		}
	}
};

observer.register();

onShutdown.add(function()
{
	observer.unregister();
});